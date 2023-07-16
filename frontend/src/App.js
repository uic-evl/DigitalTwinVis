import React, {useEffect, useState} from 'react';
// import React from 'react';
import './App.css';

// 1. import `ChakraProvider` component
import { ChakraProvider,Grid,GridItem,  Button, ButtonGroup, Select} from '@chakra-ui/react';

import DataService from './modules/DataService';
import Utils from './modules/Utils';

import ScatterPlotD3 from './components/ScatterPlotD3';
import PatientEditor from './components/PatientEditor';
function App() {

  const defaultPatient = {
    'T-category_4': 1,
    'age': 65,
    'bilateral': 1,
    'hpv': 1,
    'subsite_BOT': 1
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
  const [cohortLoaded,setCohortLoaded] = useState(false);
  const [modelOutput,setModelOutpt] = useState('imitation');

  const [currState, setCurrState] = useState(0);//0-2

  function getUpdatedPatient(features){
    let p = Object.assign({},patientFeatures);
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
    const pData = await api.getPatientData();
    console.log('patient data loaded');
    if(pData !== undefined){
      setCohortData(pData);
      setCohortLoaded(true);
    } else{
      console.log('error setting cohort data');
    }
  }

  async function fetchCohortEmbeddings(){
    if(cohortEmbeddings !== undefined){ return }
    const pData = await api.getPatientEmbeddings();
    console.log('patient embeddings loaded',pData);
    if(pData!== undefined){
      setCohortEmbeddings(pData);
    } else{
      console.log('error setting cohort embeddings');
    }
  }

  async function fetchPatientSimulation(){
    const sim = await api.getPatientSimulation(patientFeatures);
    setSimulation(undefined);
    if(sim.data !== undefined){
      console.log('patient simulation',sim);
      setSimulation(sim.data);
    } else{
      console.log('error setting patient simulation');
    }
  }

  async function fetchPatientNeighbors(){
    const embed = await api.getPatientNeighbors(patientFeatures);
    setCurrEmbeddings(undefined);
    if(embed.data !== undefined){
      console.log('patient embedding and neighbors',embed.data);
      setCurrEmbeddings(embed.data);
    } else{
      console.log('error setting patient embedding and neighbors');
    }
  }


  useEffect(() => {
    fetchCohort();
    fetchCohortEmbeddings();
  },[]);

  useEffect(() => {
    fetchPatientNeighbors();
    fetchPatientSimulation();
  },[patientFeatures])

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


    return (
      <>
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
        <Button>{"Decision:"}</Button>
        {tempButtons}
      </>
    )
  }


  function makeScatterPlot(){
    
    return (
      <Grid
        templateRows='1.6em 1fr'
        templateColumns='1fr'
        h='1000px'
        w='100px'
        className={'fillSpace'}
      >
        <GridItem w='100%' h='100%' >
          {makeButtonToggle()}
        </GridItem>
        <GridItem  w='100%' h='100%' bg='pink'>
          <ScatterPlotD3
              cohortData={cohortData}
              cohortEmbeddings={cohortEmbeddings}
              currState={currState}
              setCurrState={setCurrState}
              patientFeatures={patientFeatures}
              currEmbeddings={currEmbeddings}
              modelOutput={modelOutput}
              simulation={simulation}
              
          />
        </GridItem>
      </Grid>
    )
  }
  
  function makeThing(){
    return (
        <Grid
        templateRows='1.6em 1fr'
        templateColumns='1fr'
        h='1000px'
        w='100px'
        className={'fillSpace'}
      >
        <GridItem w='100%' h='100%' >
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
        <GridItem  w='100%' h='100%' bg='pink'>
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
          ></PatientEditor>
          </div>
        </GridItem>
      </Grid>
    )
  }

  return (
    <ChakraProvider>
      <Grid
        h='100%'
        w='100%'
        templateRows='2em repeat(4,1fr)'
        templateColumns='calc(55vw + 1em) repeat(2,1fr)'
        gap={1}
      >
        <GridItem rowSpan={1} colSpan={3} >
          {'1'}
        </GridItem>
        <GridItem rowSpan={4} className={'shadow scroll'} colSpan={1}>
          {'2'}
        </GridItem>
        <GridItem rowSpan={2} colSpan={2} className={'shadow'}>
          {makeScatterPlot()}
        </GridItem>
        <GridItem rowSpan={2} colSpan={2} className={'shadow scroll'}>
          {makeThing()}
        </GridItem>
      </Grid>
    </ChakraProvider>
  );
}

export default App;
