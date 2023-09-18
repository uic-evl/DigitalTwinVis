import React, {useEffect, useState, useMemo} from 'react';
// import React from 'react';
import './App.css';

// 1. import `ChakraProvider` component
import { ChakraProvider, Grid, GridItem,  Button, ButtonGroup, Spinner, Tabs, TabList, TabPanels, Tab, TabPanel} from '@chakra-ui/react';

import DataService from './modules/DataService';
import Utils from './modules/Utils';
import * as constants from "./modules/Constants.js";
import ScatterPlotD3 from './components/ScatterPlotD3';
import PatientEditor from './components/PatientEditor';
import LNVisD3 from './components/LNVisD3';
import DLTVisD3 from './components/DLTVisD3';
import SubsiteVisD3 from './components/SubsiteVisD3';
import {NeighborVisD3,NeighborVisLabels} from './components/NeighborVisD3';
import RecommendationPlot from './components/RecommendationsPlot';
import OutcomePlots from './components/OutcomePlots';
import AttributionPlotD3 from './components/AttributionPlotD3';
import * as d3 from 'd3';

function App() {

  const defaultPatient = {
    'T-category_4': 1,
    'age': 65,
    'bilateral': 1,
    'hpv': 1,
    'subsite_BOT': 1,
    '1A_ipsi': 1,
    '1B_ipsi': 1,
  }
  const api = new DataService();
  const maxStackSize = 4;
  const [patientFeatures,setPatientFeatures] = useState(defaultPatient);
  const [featureQue,setFeatureQue] = useState({});
  const [previousPatientStack,setPreviousPatientStack] = useState([]);
  const [simulation,setSimulation] = useState();
  const [currEmbeddings,setCurrEmbeddings] = useState();
  const [cohortData,setCohortData] = useState();
  const [cohortEmbeddings, setCohortEmbeddings] = useState();
  const [fixedDecisions,setFixedDecisions] = useState([-1,-1,-1]);//-1 is not fixed ,0 is no, 1 is yes
  const [modelOutput,setModelOutpt] = useState('optimal');
  const [currState, setCurrState] = useState(0);//0-2

  const [cohortPredictions,setCohortPredictions] = useState();

  const [upperRightView,setUpperRightView] = useState('scatter')
  const [cohortLoading,setCohortLoading] = useState(false);
  const [cohortEmbeddingsLoading,setCohortEmbeddingsLoading] = useState(false);
  const [patientSimLoading,setPatientSimLoading]= useState(false);
  const [patientEmbeddingLoading,setPatientEmbeddingLoading] = useState(false);
  const [brushedId, setBrushedId] = useState();
  const [defaultPredictions,setDefaultPredictions] = useState();

  //dict of path strings svg for each ln + an 'outline 
  //'eg 1A_contra, 1A_ipsi, 1B_contra ...
  const [lnSvgPaths,setLnSvgPaths]= useState();
  //dict of dlt stuff, each entry is a dict with path and style
  //eg vascular: {'d': path string, 'style' 'fill:#fe7070;fill-opacity:1;stroke:#000000'}
  const [dltSvgPaths,setDltSvgPaths]= useState();
  const [subsiteSvgPaths,setSubsiteSvgPaths] = useState();
  const neighborsToShow = 7;

  //will be ['all','endpoints','response','dlts','no dlts]
  const [outcomesView, setOutcomesView] = useState('no dlts');

  const [cursor, setCursor] = useState('default')

  function getSimulation(){
    if(!Utils.allValid([simulation,modelOutput,fixedDecisions])){return undefined}
    let key = modelOutput;
    for(let i in fixedDecisions){
      let d = fixedDecisions[i];
      let di = parseInt(i) + 1
      if(d >= 0){
        let suffix = '_decision'+(di)+'-'+d;
        key += suffix;
      }
    }
    return simulation[key]
  }

  function getUpdatedPatient(features,clear=false){
    let p = clear? {}: Object.assign({},patientFeatures);
    for(let key of Object.keys(features)){
      p[key] = features[key];
    }
    return p;
  }

  function toggleModelOutput(){
    let val = modelOutput === 'imitation'? 'optimal':'imitation';
    setModelOutpt(val);
  }

  function updatePatient(fQue){
    let newStack = [...previousPatientStack];
    if(newStack.length > maxStackSize){
      newStack.shift();
    }
    newStack.push(Object.assign({},patientFeatures));
    let newPatient = getUpdatedPatient(fQue);
    setPatientFeatures(newPatient);
    setPreviousPatientStack(newStack);
    setFeatureQue({});
  };

  async function fetchCohort(){
    if(cohortData !== undefined){ return }
    if(!cohortLoading){
      setCohortLoading(true);
    } else{
      return;
    }
    const pData = await api.getPatientData();
    console.log('patient data loaded',pData);
    if(pData !== undefined){
      setCohortData(pData);
      setCohortLoading(false);
    } else{
      console.log('error setting cohort data');
    }
  }

  async function fetchCohortEmbeddings(){
    if(cohortEmbeddings !== undefined){ return }
    if(!cohortEmbeddingsLoading){
      setCohortEmbeddingsLoading(true);
    } else{
      return;
    }
    const pData = await api.getPatientEmbeddings();
    console.log('patient embeddings loaded',pData);
    if(pData!== undefined){
      setCohortEmbeddings(pData);
      setCohortEmbeddingsLoading(false);
    } else{
      console.log('error setting cohort embeddings');
    }
  }

  async function fetchDefaultPredictions(){
    if(defaultPredictions !== undefined){ return }
    const pred = await api.getDefaultPredictions();
    console.log('default predictions',pred);
    if(pred !== undefined){
      setDefaultPredictions(pred);
    }
  }

  async function fetchPatientSimulation(){
    if(patientSimLoading){ return }
    setCursor('wait')
    setPatientSimLoading(true);
    const sim = await api.getPatientSimulation(patientFeatures);
    setSimulation(undefined);
    if(sim.data !== undefined){
      console.log('patient simulation',sim);
      setSimulation(sim.data);
      setPatientSimLoading(false);
      setCursor('default')
    } else{
      console.log('error setting patient simulation');
      setCursor('default');
    }
  }

  async function fetchCohortPredictions(){
    setCohortPredictions(undefined);
    const pred = await api.getCohortPredictions();
    console.log('cohort predictions', pred);
    if(pred.data !== undefined){
      setCohortPredictions(pred.data)
    } else{
      console.log('error setting cohort predictions');
    }
  }

  async function fetchPatientNeighbors(){
    if(patientEmbeddingLoading){ return }
    setPatientEmbeddingLoading(true);
    const embed = await api.getPatientNeighbors(patientFeatures);
    setCurrEmbeddings(undefined);
    if(embed.data !== undefined){
      console.log('patient embedding and neighbors',embed.data);
      setCurrEmbeddings(embed.data);
      setPatientEmbeddingLoading(false);
    } else{
      console.log('error setting patient embedding and neighbors');
    }
  }


  useEffect(()=>{
    fetch('ln_diagrams.json').then(paths=>{
      paths.json().then(data=>{
        setLnSvgPaths(data);
      })
    })
  },[]);

  useEffect(()=>{
    fetch('dlt_diagrams.json').then(paths=>{
      paths.json().then(data=>{
        setDltSvgPaths(data);
      })
    })
  },[]);

  useEffect(()=>{
    fetch('subsite_diagrams.json').then(paths=>{
      paths.json().then(data=>{
        console.log('subsites',data)
        setSubsiteSvgPaths(data);
      })
    })
  },[]);

  useEffect(() => {
    fetchCohort();
    fetchCohortEmbeddings();
    fetchDefaultPredictions();
    //this one gives prediction confidences for all stuff in case I need it for calibration?
    // fetchCohortPredictions();
  },[]);

  useEffect(() => {
    fetchPatientNeighbors();
    fetchPatientSimulation();
  },[patientFeatures]);

  function wrapTitle(item,text){
    return (
      <div className={'fillSpace'}>
        <div style={{'height':'1.5em'}} className={'title'}>
          {text}
        </div>
        <div style={{'height':'calc(100% - 1.5em)','width':'100%'}}>
        {item}
        </div>
      </div>
    )
  }
  const Neighbors = useMemo(()=>{
    if(Utils.allValid([currEmbeddings,cohortData,simulation])){
      let decision = fixedDecisions[currState];
      if(decision < 0){
        let sim = getSimulation();
        decision = (sim['decision'+(currState+1)] > .5)? 1: 0;
      }
      const dString = constants.DECISIONS[currState];
      const getNeighbor = id => Object.assign({},cohortData[id+'']);
      var neighbors = [];
      var cfs = [];
      for(let i in currEmbeddings.neighbors){
        var id = currEmbeddings.neighbors[i];
        var sim = currEmbeddings.similarities[i];
        var nData = getNeighbor(id);
        nData.id = id;
        nData.similarity = sim;
        nData.decision = nData[dString];
        var isCf = nData[dString] !== decision;
        nData.isCf = isCf;
        const maxCfs = cfs.length >= neighborsToShow;
        const maxN = neighbors.length >= neighborsToShow;
        if(!maxCfs & isCf){
          cfs.push(nData);
        } else if(!maxN & !isCf){
          neighbors.push(nData);
        }
        if((cfs.length >= neighborsToShow) & (neighbors.length >= neighborsToShow)){
          break
        }
      }

      function getPatientMeans(plist){
        const meanObj = {};
        for(let obj of plist){
          for(let [key,value] of Object.entries(obj)){
            let currVal = meanObj[key] === undefined? 0: meanObj[key];
            currVal += value/plist.length;
            meanObj[key] = currVal
          }
        }
        meanObj.id = -2 - meanObj.decision;
        return meanObj;
      }
      const meanTreated = decision > .5? getPatientMeans(neighbors): getPatientMeans(cfs);
      const meanUntreated = decision > .5? getPatientMeans(cfs): getPatientMeans(neighbors);
      const cScale = Utils.getColorScale('attributions');
      var p = cfs.concat(neighbors);
      p.sort((a,b)=> b.similarity - a.similarity);
      const toScale = constants.continuousVars;
      var ranges = {};
      for(let key of toScale){
        let extent = d3.extent(Object.values(cohortData).map(d=>d[key]));
        ranges[key] = extent;
      }
      const thingHeight = '8em';
      const dltWidth = '4em'
      const lnWidth = '5em';
      const subsiteWidth = '4em';
      const nWidth = 'calc(100% - ' + dltWidth + ' - ' + lnWidth + ' - ' + subsiteWidth + ')'
      function makeN(d,i,useReference=true,showLabels=false,bottomBorder=false,brushable=true){
        const borderColor = d[dString] > .5? constants.yesColor: constants.noColor;
        const bBorder = bottomBorder? '.4em solid black':'';
        const marginBottom = bottomBorder? '.4em': '.01em';
        function brush(){
          let pId = parseInt(d.id)
          if(pId > 0 & pId !== brushedId){
            setBrushedId(pId);
          } else{
            setBrushedId(undefined);
          }
        }
        return (
        <div key={d.id} 
           style={{'margin':'.2em','height': thingHeight,
           'width': '100%','diplay': 'block','borderStyle':'solid',
          'borderColor': borderColor,'borderWidth':'.2em',
          'marginBottom': marginBottom,
          'borderBottom': bBorder,
          }}
          onClick={()=>brush()}
          >
          <div style={{'width': dltWidth,'height':'100%','display':'inline-block'}}>
          <DLTVisD3
            dltSvgPaths={dltSvgPaths}
            data={d}
            currState={currState}
            isMainPatient={false}
          />
          </div >
          <div style={{'width': lnWidth,'height':'100%','display':'inline-block'}}>
            <LNVisD3
              lnSvgPaths={lnSvgPaths}
              data={d}
              isMainPatient={false}
            ></LNVisD3>
          </div>
          <div style={{'width':subsiteWidth,'height':'100%','display':'inline-block'}}>
            <SubsiteVisD3
              subsiteSvgPaths={subsiteSvgPaths}
              data={d}
              isSelectable={false}
              featureQue={{}}
            ></SubsiteVisD3>
          </div>
          <div style={{'width':nWidth,'height':'100%','display':'inline-block'}}>
            <NeighborVisD3
              data={d}
              referenceData={useReference? patientFeatures: undefined}
              referenceQue={useReference? featureQue: undefined}
              key={d.id+i}
              lnSvgPaths={lnSvgPaths}
              valRanges={ranges}
              dltSvgPaths={dltSvgPaths}
              currState={currState}
              showLabels={showLabels}
            ></NeighborVisD3>
          </div>
        </div>
        )
      }
      const nStuff = p.map((d,i) => makeN(d,i,true,false));

      return (
        <div className={'fillSpace centerText'}>
            {makeN(meanTreated,'n',false,false,false)}
            {makeN(meanUntreated,'cf',false,false,false)}
        </div>);
    } else{
      return <Spinner>{'No'}</Spinner>
    }
  },[currEmbeddings,currState,cohortData,simulation,fixedDecisions,modelOutput,brushedId])

  // const confidenceCalibration = useMemo(()=>{
  //   if(Utils.allValid([simulation,cohortData,currEmbeddings,cohortEmbeddings])){
  //     const getNeighbor = id => Object.assign(Object.assign({},cohortData[id+'']),cohortEmbeddings[id+'']);
  //     var performances = [];
  //     for(let state in constants.DECISIONS){
  //       const predictionString = 'decision' + state + '_' + modelOutput;
  //       var tpr = 0;
  //       var fpr = 0;
  //       var tnr = 0;
  //       var fnr = 0;
  //       var acc = 0;
  //       let n = 0;
  //       for(let i in currEmbeddings.neighbors){
  //         var id = currEmbeddings.neighbors[i];
  //         var sim = currEmbeddings.similarities[i];
  //         var nData = getNeighbor(id);
  //         const prediction = (nData[predictionString] > .5) + 0;
  //         const trueOutcome = nData[constants.DECISIONS[state]] + 0;
  //         const correct = prediction - trueOutcome < .01;
  //         if(correct){
  //           acc += 1;
  //           if(trueOutcome > .001){
  //             tpr += 1;
  //           } else{
  //             tnr +=1
  //           }
  //         } else{
  //           if(trueOutcome > .001){
  //             fnr += 1;
  //           } else{
  //             fpr += 1
  //           }
  //         }
  //         n+=1;
  //         if(n > neighborsToShow){
  //           break;
  //         }
  //       }
  //       tpr /= n;
  //       fpr /= n;
  //       tnr /= n;
  //       fnr /= n;
  //       acc /= n;
  //       const entry = {
  //         'tpr': tpr,
  //         'fpr': fpr,
  //         'tnr': tnr,
  //         'fnr': fnr,
  //         'acc': acc,
  //       }
  //       performances.push(entry);
  //     }

  //     return performances
  //   }
  //   return false
  // },[simulation,cohortData,currEmbeddings,cohortEmbeddings]);

  function getSimulation(){
    if(!Utils.allValid([simulation,modelOutput,fixedDecisions])){return undefined}
    let key = modelOutput;
    for(let i in fixedDecisions){
      let d = fixedDecisions[i];
      let di = parseInt(i) + 1
      if(d >= 0){
        let suffix = '_decision'+(di)+'-'+d;
        key += suffix;
      }
    }
    return simulation[key]
  }

  const [Outcomes,Recommendation] = useMemo(()=>{
    if(Utils.allValid([simulation,cohortData,currEmbeddings,cohortEmbeddings])){
      const maxN = 10;
      let currKey = modelOutput;
      let altKey = modelOutput;
      let currPredictions = ['1','2','3'].map(i=> (simulation[modelOutput]['decision'+i] > .5) + 0);
      const currPropensity = simulation['imitation']['decision'+ (currState+1)];
      let currDecision = 0;
      for(let i in fixedDecisions){
        let d = fixedDecisions[i];
        let di = parseInt(i) + 1;
        let trueDecision = d >= 0? d: currPredictions[i];
        let suffix = '';
        if(d >= 0){
          suffix = '_decision'+(di)+'-'+d;
        }
        currKey += suffix;
        if(parseInt(i) !== parseInt(currState)){
          altKey += suffix;
        } else{
          let altDecision = trueDecision > 0? 0: 1;
          let altSuffix = '_decision' + (di) + '-' + altDecision;
          altKey += altSuffix;
          currDecision = trueDecision;
        }
      }
      const sim = simulation[currKey];
      const altSim = simulation[altKey];

      const getNeighbor = id => Object.assign(Object.assign({},cohortData[id+'']),cohortEmbeddings[id+'']);
      var neighbors= [];
      var cfs = [];
      var similarDecisions = [];
      const nToShow = 50; //bad name now but the max # of similar patients before balancing propensity;
      var nPropensity = [0];
      var cfPropensity = [0];
      for(let i in currEmbeddings.neighbors){
        var id = currEmbeddings.neighbors[i];
        var nData = getNeighbor(id);
        const prediction = nData[constants.DECISIONS[currState]];
        const propensity = nData['decision'+(currState)+"_imitation"];
        nData.propensity = propensity;
        nData.propensity_diff = Math.abs(currPropensity - propensity);
        if(similarDecisions.length < 20){
          similarDecisions.push(prediction);
        }
        if(neighbors.length < nToShow & prediction === currDecision){
          neighbors.push(nData);
          nPropensity.push((nPropensity[nPropensity.length-1] + nData.propensity));
        } else if(cfs.length < nToShow & prediction !== currDecision){
          cfs.push(nData);
          cfPropensity.push((cfPropensity[cfPropensity.length-1] + nData.propensity));
        }
        if( cfs.length > nToShow & neighbors.length > nToShow){
          break;
        }
      }

      //so basically from the pool of similar patients I'm finding the # to use that minimizes
      //the average diference in propensity score so the outcomes approximates a causal effect
      nPropensity = nPropensity.map((d,i) => d/(i+1));
      cfPropensity = cfPropensity.map((d,i) => d/(i+1));
      let optimalLoc = 5;
      let minPropDiff = 1;
      for(let i in cfPropensity){
        if(i < optimalLoc){
          continue;
        }
        let cfP = cfPropensity[i];
        let nP = nPropensity[i];
        let diff = Math.abs(cfP - nP);
        if(diff < minPropDiff){
          optimalLoc = i;
          minPropDiff = diff;
        }
        if(minPropDiff < .01){
          break
        }
      }
      cfs = cfs.slice(0,optimalLoc);
      neighbors = neighbors.slice(0,optimalLoc);

      var outcomes = constants.OUTCOMES;
      if(currState == 0){
        outcomes = outcomes.concat(constants.dlts1);
        outcomes = outcomes.concat(constants.primaryDiseaseProgressions);
        outcomes = outcomes.concat(constants.nodalDiseaseProgressions);
      } else if(currState == 1){
        outcomes = outcomes.concat(constants.dlts2);
        outcomes = outcomes.concat(constants.primaryDiseaseProgressions2);
        outcomes = outcomes.concat(constants.nodalDiseaseProgressions2);
      }
      var neighborPredictions = {};
      var cfPredictions = {};
      for(let key of outcomes){
        neighborPredictions[key] = Utils.mean(neighbors.map(d=>d[key]));
        cfPredictions[key] = Utils.mean(cfs.map(d=>d[key]));
      }

      const recommendedDecision = simulation[modelOutput]['decision'+(currState+1)];

      const outcomeViewOptions = currState < 2? ['all','endpoints','disease response','dlts','no dlts']: ['endpoints'];
      function makeOutcomeToggle(){
        const buttons = outcomeViewOptions.map((n,i) => {
          const isActive = n === outcomesView;
          const onclick = isActive? ()=>{}: ()=>setOutcomesView(n);
          return( 
            <Button
              onClick={onclick}
              variant={isActive? 'ghost': 'solid'}
              colorScheme={isActive? 'teal':'blue'}
              key={i}
            >{Utils.getVarDisplayName(n)}</Button>
          )
        })
        return buttons
      }


      return [(
      <>
      <div style={{'height': '1.5em','width':'100%'}}>
            {makeOutcomeToggle()}
      </div>
      <div style={{'height': 'calc(100% - 1.5em','width':'100%'}} className={'noGutter'}>
        <OutcomePlots
          sim={sim}
          altSim={altSim}
          neighborOutcomes={neighborPredictions}
          counterfactualOutcomes={cfPredictions}
          mainDecision={currDecision}
          state={currState}
          outcomesView={outcomesView}
        ></OutcomePlots>
      </div>
      </>
      ),
      (
        <div className={'fillSpace noGutter shadow'}>
          <div className={'title'}  style={{'height': '1em','width':'100%'}}>
            {'Recommended Treatment'}
          </div>
          <div style={{'height': 'calc(100% - 1em)'}}>
            <RecommendationPlot
              decision={recommendedDecision}
              state={currState}
              neighborDecisions={similarDecisions}
            ></RecommendationPlot>
          </div>
        </div>
      )
      ]
    } else{
      return [
        (<Spinner/>),
        (
        <div className={'fillSpace noGutter shadow'}>
          <div className={'centerText'}  style={{'height': '1.5em','width':'100%'}}>
            {'Recommended'}
          </div>
          <div style={{'height': 'calc(100%-1.5em)','width':'100%'}}>
          <Spinner/>
          </div>
        </div>
      )
      ]
    }
  },[simulation,cohortData,currEmbeddings,modelOutput,currState,cohortEmbeddings,fixedDecisions,outcomesView]);

  function makeButtonToggle(){
    var makeButton = (state,text)=>{
      let isActive = state === currState;
      let style = isActive? 'default':'pointer';
      return (
        <Button
          key={text+state}
          onClick={()=>setCurrState(state)}
          disabled={isActive}
          variant={isActive? 'ghost': 'solid'}
          colorScheme={isActive? 'teal':'blue'}
          style={{'cursor':style}}
        >{text}</Button>
      )
    }

    let toggles = [0,1,2];
    let tNames = ['IC','CC','ND'];
    let tempButtons = toggles.map((s,i)=>{
      return makeButton(s,tNames[i]);
    })
    function fixDecision(i,v){
      let fd = fixedDecisions.map(i=>i);
      fd[i] = v;
      setFixedDecisions(fd);
    }
    let radioButtons = [0,1,2].map(i=>{
      let getVariant = (val) => {
        if(fixedDecisions[i] == val){
          return 'outline'
        } 
        return 'solid'
      }
      let getColor = (val) => {
        if(fixedDecisions[i] == val){
          return 'teal'
        } 
        return 'blue'
      }
      let names = ['N',tNames[i],'Y'];
      let btns = [0,-1,1].map((bval,ii) => {
        return (
          <Button
            onClick={()=>fixDecision(i,bval)}
            variant={getVariant(bval)}
            colorScheme={getColor(bval)}
          >{names[ii]}</Button>
        )
      })
      return (<ButtonGroup 
        isAttached
        style={{'display':'inline','margin':10}}
        spacing={0}
      >
        {btns}
      </ButtonGroup>)
    })

    return (
      <>
        <Button>{"Model:"}</Button>
        <Button
          onClick={toggleModelOutput}
          disabled={modelOutput === 'optimal'}
          variant={modelOutput === 'optimal'? 'outline':'solid'}
          colorScheme={modelOutput === 'optimal'? 'teal':'blue'}
        >{"Optimal"}</Button>
        <Button
          onClick={toggleModelOutput}
          disabled={modelOutput === 'imitation'}
          variant={modelOutput === 'imitation'? 'outline':'solid'}
          colorScheme={modelOutput === 'imitation'? 'teal':'blue'}
        >{"Imitation"}</Button>
        <div style={{'display': 'inline','width':'auto'}}>{' | '}</div>
        <Button>{"Decision:"}</Button>
        {tempButtons}
        <div style={{'display': 'inline','width':'auto'}}>{' | '}</div>
        <Button>{'Fix Decisions'}</Button>
        {radioButtons}
      </>
    )
  }

  function makeScatterplot(){
    const scatter = (
        <ScatterPlotD3
            cohortData={cohortData}
            cohortEmbeddings={cohortEmbeddings}
            currState={currState}
            setCurrState={setCurrState}
            patientFeatures={patientFeatures}
            currEmbeddings={currEmbeddings}
            modelOutput={modelOutput}
            simulation={simulation}

            patientEmbeddingLoading={patientEmbeddingLoading}
            patientSimLoading={patientSimLoading}
            cohortLoading={cohortLoading}
            cohortEmbeddingsLoading={cohortEmbeddingsLoading}

            updatePatient={updatePatient}

            brushedId={brushedId}
            setBrushedId={setBrushedId}
        />
    );
    return wrapTitle(scatter,'ScatterPlot')
  }

  function makeAttributionPlot(){
    const attr = (
      <AttributionPlotD3
          simulation={simulation}
          modelOutput={modelOutput}
          currState={currState}
          defaultPredictions={defaultPredictions}
        />
    )
    return wrapTitle(attr,'Model Feature Importance');
  }

  function makeToggleView(key){
    if(key.includes('scatter')){
      return makeScatterplot();
    }
    else{
      return makeAttributionPlot();
    }
  }


  function makeThing(){
    return (
        <Grid
        templateRows='1.6em 1.6em 1fr 13.5em'
        templateColumns='1fr 1fr'
        h='1000px'
        w='100px'
        className={'fillSpace'}

      >
        <GridItem w='100%' h='100%' colSpan={2} rowSpan={1}>
          <Button 
            onClick={()=>updatePatient(featureQue)}
            variant={'outline'}
            colorScheme={'grey'}
            disabled={featureQue === undefined | Object.keys(featureQue).length < 1}
          >{'Run Changes'}</Button>
          <Button
            onClick={()=>setFeatureQue({})}
            variant={'outline'}
            colorScheme={'red'}
          >{'Reset'}</Button>
        </GridItem>
        <GridItem colSpan={2} rowSpan={1} className={'title'}>
          {'Patient Features'}
        </GridItem>
        <GridItem colSpan={2} rowSpan={1}>
          <div className={'fillSpace noGutter'}>
            <PatientEditor
                cohortData={cohortData}
                cohortEmbeddings={cohortEmbeddings}
                patientFeatures={patientFeatures}
                featureQue={featureQue}
                setPatientFeatures={setPatientFeatures}
                setFeatureQue={setFeatureQue}
                currEmbeddings={currEmbeddings}
                simulation={simulation}
                modelOutput={modelOutput}
                currState={currState}
                updatePatient={updatePatient}

                patientEmbeddingLoading={patientEmbeddingLoading}
                patientSimLoading={patientSimLoading}
                cohortLoading={cohortLoading}
                cohortEmbeddingsLoading={cohortEmbeddingsLoading}

                fixedDecisions={fixedDecisions}
                setFixedDecisions={setFixedDecisions}
                getSimulation={getSimulation}
                brushedId={brushedId}

                neighborsToShow={neighborsToShow}
            ></PatientEditor>
            </div>
        </GridItem>
        <GridItem  colSpan={1} rowSpan={1}>
          <div className={'title'} style={{'height': '1.5em'}}>{'Subsite'}</div>
          <div style={{'height': 'calc(100% - 1.5em)'}}>
          <SubsiteVisD3
            data={patientFeatures}//required
            featureQue={featureQue}
            setPatientFeatures={setPatientFeatures}
            setFeatureQue={setFeatureQue}
            isSelectable={true}//this determines if you can actually use it to update the que
            subsiteSvgPaths={subsiteSvgPaths}//required
          />
          </div>
          
        </GridItem>
        <GridItem colSpan={1} rowSpan={1}>
          <div className={'title'} style={{'height': '1.5em'}}>{'Lymph Nodes'}</div>
          <div style={{'height': 'calc(100% - 1.5em)'}}>
          <LNVisD3
            lnSvgPaths={lnSvgPaths}
            data={patientFeatures}
            isMainPatient={true}
            patientFeatures={patientFeatures}
            setPatientFeatures={setPatientFeatures}
            setFeatureQue={setFeatureQue}
            featureQue={featureQue}
            modelOutput={modelOutput}
            simulation={simulation}
            fixedDecisions={fixedDecisions}
            state={currState}
            useAttention={true}
          />
          </div>
        </GridItem>
        {/* <GridItem colSpan={1} rowSpan={1}>
          <div className={'title'} style={{'height': '1.5em'}}>{'DLTs'}</div>
          <div style={{'height': 'calc(100% - 1.5em)'}}>
          <DLTVisD3
            dltSvgPaths={dltSvgPaths}
            data={getSimulation()}
            currState={currState}
          />
          </div>
        </GridItem>
        <GridItem colSpan={1} rowSpan={1}>
        <div className={'title'} style={{'height': '1.5em'}}>{'Legend'}</div>
          <div style={{'height': 'calc(100% - 1.5em)'}}>
          {"Something"}
          </div>
        </GridItem> */}
      </Grid>
    )
  }

  return (
    <ChakraProvider>
      <Grid
        h='95%'
        w='100%'
        templateRows='2em repeat(2,1fr)'
        templateColumns='25em repeat(4,1fr) 1em'
        gap={1}
        style={{'cursor':cursor}}
      >
        <GridItem rowSpan={1} colSpan={6} className={'shadow'}>
          {makeButtonToggle()}
        </GridItem>
        <GridItem  rowSpan={2} colSpan={1} className={'shadow'}>
          {makeThing()}
        </GridItem>
        <GridItem rowSpan={2} colSpan={2} className={'shadow'}>
          <Grid 
            h="100%"
            w="100%"
            templateRows='1fr 6em'
            templateCols='1fr'
          >
            <GridItem rowSpan={1} style={{'overflowY':'scroll'}}>
              {Outcomes}
            </GridItem>
            <GridItem rowSpan={1}>
              {Recommendation}
            </GridItem>
            
          </Grid>
        </GridItem>
        <GridItem rowSpan={2} colSpan={3}>
          <Grid
            h="100%"
            w="100%"
            templateRows='repeat(3,1fr)'
          >
            <GridItem rowSpan={1} className={'shadow'}>
              {makeScatterplot()}
            </GridItem>
            <GridItem rowSpan={1}  className={'shadow'}>
              {makeAttributionPlot()}
            </GridItem>
            <GridItem className={'shadow'}>
              {Neighbors}
            </GridItem>
          </Grid>
        </GridItem>
        
      </Grid>
    </ChakraProvider>
  );
}

export default App;
