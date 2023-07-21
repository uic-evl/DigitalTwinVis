import React, {useEffect, useState, useMemo} from 'react';
// import React from 'react';
import './App.css';

// 1. import `ChakraProvider` component
import { ChakraProvider, Grid, GridItem,  Button, ButtonGroup, Spinner} from '@chakra-ui/react';

import DataService from './modules/DataService';
import Utils from './modules/Utils';
import * as constants from "./modules/Constants.js";
import ScatterPlotD3 from './components/ScatterPlotD3';
import PatientEditor from './components/PatientEditor';
import LNVisD3 from './components/LNVisD3';
import DLTVisD3 from './components/DLTVisD3';
import NeighborVisD3 from './components/NeighborVisD3';

import * as d3 from 'd3';

function App() {

  const defaultPatient = {
    'T-category_4': 1,
    'age': 65,
    'bilateral': 1,
    'hpv': 1,
    'subsite_BOT': 1,
    '1A': 1,
    '2B': 2,
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

  const [cohortLoading,setCohortLoading] = useState(false);
  const [cohortEmbeddingsLoading,setCohortEmbeddingsLoading] = useState(false);
  const [patientSimLoading,setPatientSimLoading]= useState(false);
  const [patientEmbeddingLoading,setPatientEmbeddingLoading] = useState(false);
  const [brushedId, setBrushedId] = useState();

  //dict of path strings svg for each ln + an 'outline 
  //'eg 1A_contra, 1A_ipsi, 1B_contra ...
  const [lnSvgPaths,setLnSvgPaths]= useState();
  //dict of dlt stuff, each entry is a dict with path and style
  //eg vascular: {'d': path string, 'style' 'fill:#fe7070;fill-opacity:1;stroke:#000000'}
  const [dltSvgPaths,setDltSvgPaths]= useState();
  const neighborsToShow = 5;

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

  async function fetchPatientSimulation(){
    if(patientSimLoading){ return }
    setPatientSimLoading(true);
    const sim = await api.getPatientSimulation(patientFeatures);
    setSimulation(undefined);
    if(sim.data !== undefined){
      console.log('patient simulation',sim);
      setSimulation(sim.data);
      setPatientSimLoading(false);
    } else{
      console.log('error setting patient simulation');
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

  useEffect(() => {
    fetchCohort();
    fetchCohortEmbeddings();
  },[]);

  useEffect(() => {

    fetchPatientNeighbors();
    fetchPatientSimulation();
  },[patientFeatures]);

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
        var isCf = nData[dString] === decision;
        nData.isCf = isCf;
        const maxCfs = cfs.length >= neighborsToShow;
        const maxN = neighbors.length >= neighborsToShow;
        if(!maxCfs & isCf){
          cfs.push(nData);
        } else if(!maxN){
          neighbors.push(nData);
        }
        if((cfs.length >= neighborsToShow) & (neighbors.length >= neighborsToShow)){
          break
        }
      }
      const cScale = Utils.getColorScale('attributions');
      var p = cfs.concat(neighbors);
      p.sort(d=>d.similarity);
      
      const toScale = constants.continuousVars;
      var ranges = {};
      for(let key of toScale){
        let extent = d3.extent(Object.values(cohortData).map(d=>d[key]));
        ranges[key] = extent;
      }
      const nStuff = p.map((d,i) => {
        const borderColor = d[dString] > .5? constants.yesColor: constants.noColor;
        return (
        <div key={d.id} 
        style={{'marginTop':'.5em','height': '8em','width': '100%','diplay': 'block','borderStyle':'solid','borderColor': borderColor,'borderWidth':'.5em'}}>
          <div style={{'width':'10em','height':'100%','display':'inline-block'}}>
            <LNVisD3
              lnSvgPaths={lnSvgPaths}
              data={d}
              isMainPatient={false}
            ></LNVisD3>
          </div>
          <div style={{'width':'10em','height':'100%','display':'inline-block'}}>
          <DLTVisD3
            dltSvgPaths={dltSvgPaths}
            data={d}
            currState={currState}
            isMainPatient={false}
          />
          </div>
          <div style={{'width':'calc(100% - 20em)','height':'100%','display':'inline-block'}}>
            <NeighborVisD3
              data={d}
              referenceData={patientFeatures}
              referenceQue={featureQue}
              key={d.id+i}
              lnSvgPaths={lnSvgPaths}
              valRanges={ranges}
              dltSvgPaths={dltSvgPaths}
            ></NeighborVisD3>
          </div>
        </div>
        )
      })
      return nStuff;
    } else{
      return <Spinner>{'No'}</Spinner>
    }
  },[currEmbeddings,currState,cohortData,simulation,fixedDecisions,modelOutput])

  const Outcomes = useMemo(()=>{
    if(Utils.allValid([simulation,cohortData,currEmbeddings])){
      var neighborOutcomes = constants.OUTCOMES.map(o => { return {'yes': [], 'no': []} });
      const getNeighbor = id => Object.assign({},cohortData[id+'']);
      var withTreatment = [];
      var withoutTreatment = [];
      for(let i in currEmbeddings.neighbors){
        var id = currEmbeddings.neighbors[i];
        var sim = currEmbeddings.similarities[i];
        var nData = getNeighbor(id);
        for(let i in constants.OUTCOMES){
          continue
        }
      }


      return (<div>{'yes'}</div>)
    } else{
      return <Spinner></Spinner>
    }
  },[simulation,cohortData,currEmbeddings,modelOutput,currState]);

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


  function makeScatterPlot(){
    return (
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
  }

  function makeThing(){
    return (
        <Grid
        templateRows='1.6em 1fr 1fr'
        templateColumns='1fr 1fr 1fr'
        h='1000px'
        w='100px'
        className={'fillSpace'}
      >
        <GridItem w='100%' h='100%' colSpan={3}>
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
        <GridItem colSpan={3}>
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
        <GridItem  colSpan={1}>
          <DLTVisD3
            dltSvgPaths={dltSvgPaths}
            data={getSimulation()}
            currState={currState}
          />
        </GridItem>
        <GridItem colSpan={1}>
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
        </GridItem>
        <GridItem colSpan={1}>
          {'legend?'}
        </GridItem>
      </Grid>
    )
  }

  return (
    <ChakraProvider>
      <Grid
        h='100%'
        w='100%'
        templateRows='2em repeat(2,1fr)'
        templateColumns='repeat(3,1fr)'
        gap={1}
      >
        <GridItem rowSpan={1} colSpan={3} className={'shadow'}>
          {makeButtonToggle()}
        </GridItem>
        <GridItem rowSpan={1} className={'shadow'} colSpan={2}>
          {makeThing()}
        </GridItem>
        <GridItem rowSpan={1} colSpan={1} className={'shadow'}>
          {Outcomes}
        </GridItem>
        <GridItem rowSpan={1} colSpan={1} className={'shadow'}>
          {makeScatterPlot()}
        </GridItem>
        <GridItem rowSpan={1} colSpan={2} className={'shadow scroll'}>
          {Neighbors}
        </GridItem>
        {/* <GridItem rowSpan={1} colSpan={1} className={'shadow'}>
          {'bottom right'}
        </GridItem> */}
      </Grid>
    </ChakraProvider>
  );
}

export default App;
