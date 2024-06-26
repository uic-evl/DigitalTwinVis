import React, {useEffect, useState, useMemo, useRef, Fragment} from 'react';
// import React from 'react';
import './App.css';

// 1. import `ChakraProvider` component
import { ChakraProvider, Grid, GridItem,  Button, ButtonGroup, Spinner} from '@chakra-ui/react';


import DataService from './modules/DataService';
import Utils from './modules/Utils';
import * as constants from "./modules/Constants.js";
import PatientEditor from './components/PatientEditor';
import LNVisD3 from './components/LNVisD3';
import SubsiteVisD3 from './components/SubsiteVisD3';
import RecommendationPlot from './components/RecommendationsPlot';
import OutcomePlots from './components/OutcomePlots';
import AuxillaryViews from './components/AuxillaryViews';
import DistanceHistogramD3 from './components/DistanceHistogramD3';
import * as HelpTexts from './modules/Text';
import HelpText from './modules/HelpText';
import Tutorial from './components/Tutorial';
import Feedback from './components/Feedback';
import About from './components/About';
import OutcomeContainer from './components/OutcomeContainer.js';

export default function MainApp({authToken,setAuthToken}) {


  const defaultPatient = {
    'T-category_1': 1,
    'T-category_2': 0,
    'T-category_3': 0,
    'T-category_4': 0,
    'N-category_1':1,
    'T-category_0': 0,
    'T-category_2': 0,
    'T-category_3': 0,
    'AJCC_1': 1,
    'AJCC_2': 0,
    'AJCC_3': 0,
    'AJCC_4': 0,
    'Pathological Grade_3': 1,
    'Pathological Grade_0': 0,
    "Pathological Grade_1": 0,
    "Pathological Grade_2": 0,
    'age': 55,
    'bilateral': 0,
    'hpv': 1,
    'subsite_BOT': 1,
    'subsite_Tonsil': 0,
    'subsite_GPS': 0,
    'subsite_Pharyngeal_wall': 0,
    'subsite_Soft_palate': 0,
    '2A_ipsi': 1,
    '2B_ipsi': 1,
    'total_dose':66,
    'dose_fraction':2.4,
    'gender': 1,
    'White/Caucasion': true,
    'dose_fraction': 2,
    'packs_per_year': 0,
    'Aspiration rate Pre-therapy': false,
    'Asian': false,
    "African American/Black": false,
    "Hispanic/Latino": false,

  }
  const token = authToken? authToken: localStorage.getItem('token')
  const api = new DataService(token,setAuthToken);
  const maxStackSize = 4;
  //load patient from localstorage if its there
  const [patientFeatures,setPatientFeatures] = useState(localStorage.getItem('patientFeatures') !== null? JSON.parse(localStorage.getItem('patientFeatures')): defaultPatient);
  const [featureQue,setFeatureQue] = useState({});
  const [previousPatientStack,setPreviousPatientStack] = useState([]);
  const [simulation,setSimulation] = useState();
  const [currEmbeddings,setCurrEmbeddings] = useState();
  const [symptoms,setSymptoms] = useState();
  const [cohortData,setCohortData] = useState(localStorage.getItem('cohortData') !== null? JSON.parse(localStorage.getItem('cohortData')) : undefined);
  const [cohortEmbeddings, setCohortEmbeddings] = useState();
  const [fixedDecisions,setFixedDecisions] = useState([-1,-1,-1]);//-1 is not fixed ,0 is no, 1 is yes
  const [modelOutput,setModelOutput] = useState('imitation');
  const [currState, setCurrState] = useState(0);//0-2

  const [fixedDecisionsCue, setFixedDecisionsCue] = useState([null,null,null]);
  const [modelOutputCue,setModelOutputCue] = useState();
  const [currStateCue, setCurrStateCue] = useState();


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


  const [cursor, setCursor] = useState('default');

  function getDeviceLevel(width,height){
    const isLarge = window.innerWidth > 900;
    const isSmall = window.innerWidth < 400;
    if(isSmall){ return 0 }
    if(isLarge){ return 2}
    return 1;
  }
  const [deviceLevel,setDeviceLevel] = useState(getDeviceLevel(window.innerWidth,window.innerHeight));
  const [isLandscape, setIsLandscape] = useState(window.innerWidth < window.innerHeight);

  function handleWindowSizeChange() {
    setDeviceLevel(getDeviceLevel(window.innerWidth,window.innerHeight));
    setIsLandscape(window.innerWidth < window.innerHeight);
  }

  useEffect(()=>{
    window.addEventListener('resize', handleWindowSizeChange);
    return () => {
        window.removeEventListener('resize', handleWindowSizeChange);
    }
  },[]);
  
  const colWidths = ['25vw','45vw','25vw'];
  const [colAdjust, setColAdjust] = useState([0,0,0]);
  const [hasRun,setHasRun] = useState(localStorage.getItem('hasRun')? localStorage.getItem('hasRun'): false);

  function getColWidth(i){
    return colAdjust[i] > 0? 'calc(' + colWidths[i] + ' + ' + colAdjust[i] + 'px)': 'calc(' + colWidths[i] + ' - ' + Math.abs(colAdjust[i]) + 'px)';
  }

  
  function queDefaultPatient(){
    let newQ = Object.assign({},defaultPatient);
    for(let [key,val] of Object.entries(patientFeatures)){
      if(newQ[key] === undefined & val !== 0){
        if(constants.continuousVars.indexOf(key) > -1){
          newQ[key] = -Infinity;
        } else{
          newQ[key] = 0;
        }
        
      }
    }
    setFeatureQue(newQ)
  }


  function getUpdatedPatient(features,clear=false){
    let p = clear? {}: Object.assign({},patientFeatures);
    for(let [key,value] of Object.entries(features)){
      if(value === -Infinity){
        if(p[key] !== undefined){
          delete p[key];
        }
      } else{
        p[key] = value;
      }
    }
    return p;
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
    
    let newDecisions = [...fixedDecisions]
    let fdChanged=false;
    for(let i in newDecisions){
      let qVal = fixedDecisionsCue[i]
      if(qVal !== null && qVal !== newDecisions[i]){
        newDecisions[i] = qVal;
        fdChanged=true;
      }
    }
    if(fdChanged){
      setFixedDecisions(newDecisions);
    }
    setFixedDecisionsCue([null,null,null]);

    if(modelOutputCue !== undefined && modelOutputCue !== modelOutput){
      setModelOutput(modelOutputCue+"");
    }
    setModelOutputCue(undefined);

    if(currStateCue !== undefined && currStateCue !== currState){
      setCurrState(currStateCue+0);
    }
    setCurrStateCue(undefined);
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

  const [mDists,setMDists] = useState();
  async function fetchMahalanobisHistograms(){
    setMDists(undefined)
    const mData = await api.getMahalanobisHistogram()
    setMDists(mData);
  }

  async function fetchDefaultPredictions(){
    if(defaultPredictions !== undefined){ return }
    const pred = await api.getDefaultPredictions();
    if(pred !== undefined){
      setDefaultPredictions(pred);
    }
  }

  async function fetchPatientSimulation(){
    if(patientSimLoading){ return }
    setCursor('wait')
    setPatientSimLoading(true);
    const sim = await api.getPatientSimulation(patientFeatures,modelOutput,fixedDecisions,currState);
    setSimulation(undefined);
    setSymptoms(undefined);
    setCurrEmbeddings(undefined);
    if(sim !== undefined ){
      if(sim.data !== undefined){
        console.log('patient simulation',sim);
        setSimulation(sim.data.simulation);
        setCurrEmbeddings(sim.data.embeddings[currState])
        setSymptoms(sim.data.symptoms)
        setPatientSimLoading(false);
        setCursor('default');
      }
    } else{
      console.log('error setting patient simulation');
      setCursor('default');
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
        //quick hack to make the outline the NOS subsite instead
        data['NOS'] = ''+data['outline'];
        delete data['outline'];
        setSubsiteSvgPaths(data);
      })
    })
  },[]);

  useEffect(() => {
    fetchCohort();
    fetchCohortEmbeddings();
    fetchDefaultPredictions();
    fetchMahalanobisHistograms();
    //this one gives prediction confidences for all stuff in case I need it for calibration?
    // fetchCohortPredictions();
  },[]);

  //todo: ask about this. Currstate will update for every change and is slower, but only is needed for small edge cases 
  // i.e. (fixed outcomes in higher state, query with lower state, then swich back  without updating anything)
  useEffect(()=>{
    fetchPatientSimulation();
  },[patientFeatures,currState,modelOutput,fixedDecisions])

  useEffect(()=>{
    if(patientFeatures!== undefined && patientFeatures !== null){
      localStorage.setItem('patientFeatures',JSON.stringify(patientFeatures));
    }
  },[patientFeatures])

  useEffect(()=>{
    if(cohortData !== undefined && cohortData !== null){
      localStorage.setItem('cohortData',JSON.stringify(cohortData));
    }
  },[cohortData])


  function getSimulation(useAlt=false){
    if(!Utils.allValid([simulation,modelOutput])){return undefined}

    //for data loading if we switch outputs we have to wait for a new query
    if(simulation[modelOutput] === undefined){ return useAlt? [undefined,undefined]:undefined }
    let currKey = modelOutput;
    let altKey = modelOutput + '_alt';
    let currPredictions = ['1','2','3'].map(i=> (simulation[modelOutput]['decision'+i] > .5) + 0);
    let currDecision = 0;


    //go through fixed decisions to find the correct key for the simulation
    for(let i in fixedDecisions){
      let d = fixedDecisions[i];
      let trueDecision = d >= 0? d: currPredictions[i];
      if(parseInt(i) === parseInt(currState)){
        currDecision = trueDecision;
      }
    }
    var sim = simulation[currKey];
    var altSim = simulation[altKey];
    sim.currDecision = currDecision;
    altSim.currDecision = Math.abs(1-currDecision );
    if(useAlt){
      return [sim, altSim]
    }
    return sim

  }

  const Recommendation = useMemo(()=>{
    if(simulation === undefined || simulation[modelOutput] === undefined || currEmbeddings === undefined){
      return (<div className={'fillSpace noGutter shadow'}>
        <div className={'centerText'}  style={{'height': '1.5em','width':'100%'}}>
          {'Recommended'}
          <HelpText text={HelpTexts.recHelpText} />
        </div>
        <div style={{'height': 'calc(100%-1.5em)','width':'100%'}}>
        <Spinner/>
        </div>
      </div>)
    } else{
      //get the 20 patients with the highest similar and pass the decisions they had to compare to the model decision
      let similarDecisions = [];
      const getPrediction = id => cohortData[id+''][constants.DECISIONS[currState]];
      
      for(let nID of currEmbeddings.neighbors.slice(20)){
        similarDecisions.push(getPrediction(nID));
      }
      const recommendedDecision = simulation[modelOutput]['decision'+(currState+1)];
      return (
        <div className={'fillSpace noGutter shadow'}>
          <div className={'title'}  style={{'height': '1em','width':'100%'}}>
            {'Recommended Treatment'}
            <HelpText text={HelpTexts.recHelpText} />
          </div>
          <div style={{'height': 'calc(100% - 1em)'}}>
            <RecommendationPlot
              decision={recommendedDecision}
              state={currState}
              neighborDecisions={similarDecisions}
              mDists={mDists}
              currEmbeddings={currEmbeddings}
              currState={currState}
            ></RecommendationPlot>
          </div>
        </div>
      )

    }
  });

  
  function makeButtonToggle(){
    var makeButton = (state,text)=>{
      return Utils.makeStateToggles([state],currStateCue,setCurrStateCue,[text],currState);
    }

    let toggles = [0,1,2];
    let tNames = ['IC','CC','ND'];
    let tempButtons = toggles.map((s,i)=>{
      return makeButton(s,tNames[i]);
    })

    function fixDecision(i,v){
      let fd = fixedDecisionsCue.map(i=>i);
      fd[i] = v;
      setFixedDecisionsCue(fd);
    }

    let radioButtons = [0,1,2].map(i=>{
      let getVariant = (val) => {
        if(fixedDecisions[i] == val){
          return 'outline'
        } 
        return 'solid'
      }
      let getColor = (val) => {
        if(fixedDecisionsCue[i] == val){
          return 'blue'
        } 
        return 'gray'
      }
      let names = ['N',tNames[i],'Y'];
      let btns = [0,-1,1].map((bval,ii) => {
        return (
          <Button
          key={names[ii]}
            onClick={()=>fixDecision(i,bval)}
            variant={getVariant(bval)}
            colorScheme={getColor(bval)}
          >{names[ii]}</Button>
        )
      })
      return (<ButtonGroup 
        key={'fixedB'+i}
        isAttached
        style={{'display':'inline-block','margin':10,'marginTop':'.2em'}}
        spacing={0}
      >
        {btns}
      </ButtonGroup>)
    })

    const ModelToggle = Utils.makeStateToggles(['optimal','imitation'],modelOutputCue,setModelOutputCue,undefined,modelOutput);

    return (
      <>
      <div style={{'textAlign': 'left','marginTop':'.2em'}}>
        <div className={'toggleButtonLabel'} key={'modelB'}>{"Model"}<HelpText text={HelpTexts.modelHelpText}></HelpText>{':'}</div>
        {ModelToggle}
      </div>
      <div  style={{'textAlign': 'left','marginTop':'.2em'}}>
        <div className={'toggleButtonLabel'} key={'decisionB'}>{"Decision"}<HelpText text={HelpTexts.decisionHelpText}></HelpText>{':'}</div>
        {tempButtons}
      </div>
      <div  style={{'textAlign': 'left','marginTop':'.2em'}}>
        <div className={'toggleButtonLabel'} key={'fixB'}>{'Fix Decisions'}<HelpText text={HelpTexts.fixHelpText}></HelpText>{':'}</div>
        <br/>
        {radioButtons}
      </div>
      </>
    )
  }


  //patientDrawer

  function makeThing(){
    const isMobile = deviceLevel < 2 || isLandscape;
    return (
      <div className={'fillSpace'} style={{'overflowY':'hidden','width':'100%','marginLeft': isMobile? '5%':'0','marginRight':isMobile? '5%':'0','height':'100%'}}>
        <div className={'title'} style={{'height':'1.6em','width':'100%'}}>
          {'Model Parameters'}
        </div>
        <div style={{'height':'10em','width':'100%'}} className={'scroll'}>
          {makeButtonToggle()}
        </div>
        <div style={{'display':'flex','height':'1.4em','width':'100%'}} className={'title'}>
          {'Patient Features'}
          <HelpText
            text={HelpTexts.featureHelpText}
          ></HelpText>
        </div>

        <div style={{'display':'flex','height':'calc(100% - 13em - 12em - 1em)','width':'100%'}} className={'scroll'}>
            <PatientEditor
                cohortData={cohortData}
                cohortEmbeddings={cohortEmbeddings}
                currEmbeddings={currEmbeddings}
                simulation={simulation}
                modelOutput={modelOutput}
                currState={currState}
                updatePatient={updatePatient}
                patientFeatures={patientFeatures}
                featureQue={featureQue}
                setPatientFeatures={setPatientFeatures}
                setFeatureQue={setFeatureQue}

                patientEmbeddingLoading={patientEmbeddingLoading}
                patientSimLoading={patientSimLoading}
                cohortLoading={cohortLoading}
                cohortEmbeddingsLoading={cohortEmbeddingsLoading}

                fixedDecisions={fixedDecisions}
                setFixedDecisions={setFixedDecisions}
                getSimulation={getSimulation}
                brushedId={brushedId}

                fixedDecisionsCue={fixedDecisionsCue}
                modelOutputCue={modelOutputCue}
                currStateCue={currStateCue}
                setFixedDecisionsCue={fixedDecisionsCue}
                setModelOutputCue={modelOutputCue}
                setCurrStateCue={currStateCue}

            ></PatientEditor>
        </div>
        <div style={{'display':'inline-block','height':'10em','width':'45%'}}>
          <div className={'title'} style={{'height': '1.5em'}}>
            {'Subsite'}
            <HelpText text={HelpTexts.subsiteHelpText}/>
            </div>
          <div style={{'height': 'calc(100% - 1.5em)','width':'100%'}}>
          <SubsiteVisD3
            data={patientFeatures}//required
            featureQue={featureQue}
            setPatientFeatures={setPatientFeatures}
            setFeatureQue={setFeatureQue}
            isSelectable={true}//this determines if you can actually use it to update the que
            subsiteSvgPaths={subsiteSvgPaths}//required
            useAttention={true}
            modelOutput={modelOutput}
            simulation={simulation}
            fixedDecisions={fixedDecisions}
            state = {currState}
          />
          </div>
          
        </div>
        <div style={{'display':'inline-block','height':'10em','width':'45%'}}>
          <div className={'title'} style={{'height': '1.5em'}}>
            {'Lymph Nodes'}
            <HelpText text={HelpTexts.LNHelpText}/>
          </div>
          <div style={{'height': 'calc(100% - 1.5em)','width':'100%'}}>
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
            getSimulation={getSimulation}
            fixedDecisions={fixedDecisions}
            state={currState}
            useAttention={true}
          />
          </div>
        </div>
        <div style={{'height':'2em','width':'100%','paddingBottom':'.5em'}}>
          <Button 
            onClick={()=> {
              updatePatient(featureQue);
              setHasRun(true);
              localStorage.setItem('hasRun',true);
            }
            }
            variant={'outline'}
            colorScheme={'grey'}
            disabled={featureQue === undefined | Object.keys(featureQue).length < 1}
          >{'Run Changes'}</Button>
          <Button
            onClick={()=>setFeatureQue({})}
            variant={'outline'}
            colorScheme={'red'}
          >{'Reset'}</Button>
          <Button 
            variant={'outline'}
            colorScheme={'grey'}
            onClick={()=>queDefaultPatient()}
            >{'Default'}</Button>
        </div>

      </div>
    )
  }

  function makeRecomendationColumn(){
    const isMobile = deviceLevel < 2 || isLandscape;
    if(isMobile){
      return (
        <AuxillaryViews
          cohortData={cohortData}
          symptoms={symptoms}
          cohortEmbeddings={cohortEmbeddings}
          currState={currState}
          setCurrState={setCurrState}
          patientFeatures={patientFeatures}
          currEmbeddings={currEmbeddings}
          modelOutput={modelOutput}
          simulation={simulation}
          getSimulation={getSimulation}
          patientEmbeddingLoading={patientEmbeddingLoading}
          patientSimLoading={patientSimLoading}
          cohortLoading={cohortLoading}
          cohortEmbeddingsLoading={cohortEmbeddingsLoading}
          fixedDecisions={fixedDecisions}
          
          updatePatient={updatePatient}

          brushedId={brushedId}
          setBrushedId={setBrushedId}

          defaultPredictions={defaultPredictions}
          dltSvgPaths={dltSvgPaths}
          lnSvgPaths={lnSvgPaths}
          subsiteSvgPaths={subsiteSvgPaths}
        ></AuxillaryViews>
      )
    }
    return (
      <div className={'fillSpace'}>
      <div className={'shadow'} style={{'width':'100%','height':'6em'}}>
        {Recommendation}
      </div>
      <div className={'shadow'} style={{'overflowY':'hidden','width':'100%','height': 'calc(100% - 6em)'}}>
        <AuxillaryViews
          cohortData={cohortData}
          symptoms={symptoms}
          cohortEmbeddings={cohortEmbeddings}
          currState={currState}
          setCurrState={setCurrState}
          patientFeatures={patientFeatures}
          currEmbeddings={currEmbeddings}
          modelOutput={modelOutput}
          simulation={simulation}
          getSimulation={getSimulation}
          patientEmbeddingLoading={patientEmbeddingLoading}
          patientSimLoading={patientSimLoading}
          cohortLoading={cohortLoading}
          cohortEmbeddingsLoading={cohortEmbeddingsLoading}
          fixedDecisions={fixedDecisions}
          
          updatePatient={updatePatient}

          brushedId={brushedId}
          setBrushedId={setBrushedId}

          defaultPredictions={defaultPredictions}
          dltSvgPaths={dltSvgPaths}
          lnSvgPaths={lnSvgPaths}
          subsiteSvgPaths={subsiteSvgPaths}
        ></AuxillaryViews>
      </div>
    </div>)
  }

  function makeOutcomeStuff(){
    return (
      <div style={{'overflowY':'scroll','width':'100%','height':'100%'}}>
        <OutcomeContainer
          cohortData={cohortData}
          cohortEmbeddings={cohortEmbeddings}
          currState={currState}
          setCurrState={setCurrState}
          patientFeatures={patientFeatures}
          currEmbeddings={currEmbeddings}
          modelOutput={modelOutput}
          simulation={simulation}
          getSimulation={getSimulation}
          patientEmbeddingLoading={patientEmbeddingLoading}
          patientSimLoading={patientSimLoading}
          cohortLoading={cohortLoading}
          cohortEmbeddingsLoading={cohortEmbeddingsLoading}
          fixedDecisions={fixedDecisions}
          width={getColWidth(1)}
          deviceLevel={deviceLevel}
          isLandscape={isLandscape}
        ></OutcomeContainer>
      </div>
      )
  }



  if(deviceLevel < 2 || isLandscape){
    return (
      <ChakraProvider style={{'height':'auto','width':'auto','overflowY':'scroll','overflowX':'scroll'}}>
        <div style={{'position':'absolute','width': '100vw','height':'100vh','opacity': .5, 'display': cursor == 'default'? 'none':'','backgroundColor':'white','zIndex':100000000000000}}>
          <Spinner size={'xl'}></Spinner>
        </div>
        <div className={'shadow title'} style={{'fontSize': '1.5em','width': '95%','height': 'auto','margin':'0px'}}>
          <Tutorial style={{'display':'inline','height': '1em','fontSize':'.75em'}}></Tutorial>
          {'  '}
          <Feedback style={{'display':'inline','height': '1em','fontSize':'.75em'}}></Feedback>
          {'  '}
          <About style={{'display':'inline','height': '1em','fontSize':'.75em'}}></About>
        </div>
        <div style={{'display':'flex','justifyContent':'center', 'flexDirection':'column','height': 'auto'}}>
          <div style={{'height': 'auto','width': '100%','margin':'.2em','display':'flex'}} className={'shadow'}>
            {makeThing()}
          </div>
          <div className={'shadow'} style={{'width':'99vw','marginTop':'1em','display':'flex','height':'6em'}}>
            {hasRun? Recommendation: <div/>}
          </div>
          <div style={{'height': '80vh','minHeight':'50em','width': '99vw','margin':'0em','marginTop':'1em','display':'flex'}} className={'shadow scroll'}>
            {hasRun? makeOutcomeStuff(): <div/>}
          </div>
          <div style={{'height': '80vh','minHeight':'30em','width': '99vw','margin':'0em','marginTop':'1em','display':'flex'}} className={'shadow'}>
          {hasRun? makeRecomendationColumn(): <div/>}
          </div>
        </div>
      </ChakraProvider>
    )
  }

  else{
    return (
      <ChakraProvider style={{'height':'100%'}}>
        <div style={{'position':'absolute','width': '100vw','height':'100vh','opacity': .5, 'display': cursor == 'default'? 'none':'','backgroundColor':'white','zIndex':100000000000000}}>
          <Spinner size={'xl'}></Spinner>
        </div>
        <div className={'shadow title'} style={{'fontSize': '1.5em','width': '95%','height': '2em','margin':'0px'}}>
          {"OPC Digital Twin Outcome Predictions"}
          <div  style={{'display': 'inline','width':'auto'}}>{" |  "}</div>
          <Tutorial style={{'display':'inline','height': '1em','fontSize':'.75em'}}></Tutorial>
          {'  '}
          <Feedback style={{'display':'inline','height': '1em','fontSize':'.75em'}}></Feedback>
          {'  '}
          <About style={{'display':'inline','height': '1em','fontSize':'.75em'}}></About>
        </div>
        <div style={{'display':'flex','justifyContent':'center', 'height': 'calc(95vh - 2em)','overflow':'hidden'}}>
          <div style={{'height': '100%','width': getColWidth(0),'margin':'.2em','display':'inline-flex'}} className={'shadow'}>
            {makeThing()}
          </div>
          <DraggableComponentX colAdjust={colAdjust} setColAdjust={setColAdjust} index={0} style={{'width':'1em','height':'100%'}}/>
          <div style={{'height': '100%','width': getColWidth(1),'margin':'.2em','display':'inline-flex'}} className={'shadow scroll'}>
            {hasRun? makeOutcomeStuff(): <div/>}
          </div>
          <DraggableComponentX colAdjust={colAdjust} setColAdjust={setColAdjust} index={1} style={{'width':'1em','height':'100%'}}/>
          <div style={{'height': '100%','width': getColWidth(2),'margin':'.2em','display':'inline-flex'}} className={'shadow'}>
            {hasRun? makeRecomendationColumn(): <div/>}
          </div>
        </div>
      </ChakraProvider>
    )
  }


}

const DraggableComponentX = (props) => {
  const [pressed, setPressed] = useState(false)
  const [position, setPosition] = useState(0);
  const [startPosition, setStartPosition] = useState(0);

  const [linePosition,setLinePosition] = useState(0);
  const [lineHeight,setLineHeight] = useState(0);
  const ref = useRef()

  // Update the current position if mouse is down
  const upDatePosition = (event,target) => {
    if (ref.current) {
      var moveX = (event.clientX - startPosition);
      if(Math.abs(moveX) > window.screen.width/5){
        moveX = Math.sign(moveX) * (window.screen.width/5);
      }
      var newAdjusts = [...props.colAdjust];
      newAdjusts[props.index] = newAdjusts[props.index] + moveX;
      newAdjusts[props.index+1] = newAdjusts[props.index+1] - moveX;
      props.setColAdjust(newAdjusts);
    }
    setPressed(false);
    setStartPosition(event.clientX);
  }

  const startDrag  = (event) => {
    setStartPosition(event.clientX);
    setPressed(true)
  }

  const style = Object.assign({'cursor':'pointer','width':'auto','height':'100%','display':'inline-flex'},props.style)

  return (
    <div
      draggable={true}
      ref={ ref }
      style={ style }
      onDragEnd={upDatePosition}
      onMouseDown={ startDrag }
    >
      <svg style={{'height':'100%','width':'inherit','position':'absolute'}}>
        <rect height={ref.current? ref.current.clientHeight: '50%'} width={5} fill="black" x={ref.current? (ref.current.clientWidth - 5)/2: '.1em'} />
      </svg>
    </div>
  )
}
