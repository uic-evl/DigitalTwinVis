import React, {useEffect, useState} from 'react';
// import React from 'react';
import './App.css';

// 1. import `ChakraProvider` component
import { ChakraProvider,Grid,GridItem, Select,Box ,InputGroup} from '@chakra-ui/react';

import DataService from './modules/DataService';
import Utils from './modules/Utils';

import ScatterPlotD3 from './components/ScatterPlotD3';

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

  const [currState, setCurrState] = useState(2);//0-2

  function getUpdatedPatient(features){
    let p = Object.assign({},patientFeatures);
    for(let key of Object.keys(features)){
      p[key] = patientFeatures[key];
    }
    return p;
  }

  function updatePatient(){
    let newStack = [...previousPatientStack];
    if(newStack.length > maxStackSize){
      newStack.shift();
    }
    newStack.push(Object.assign({},patientFeatures));
    let newPatient = getUpdatedPatient(featureQue);
    setPatientFeatures(newPatient);
    setPreviousPatientStack(newStack);
    setFeatureQue({});
  };

  async function fetchCohort(){
    const pData = await api.getPatientData();
    console.log('patient data',pData);
    if(pData !== undefined){
      setCohortData(pData);
      setCohortLoaded(true);
    } else{
      console.log('error setting cohort data');
    }
  }

  async function fetchCohortEmbeddings(){
    const pData = await api.getPatientEmbeddings();
    console.log('patient embeddings',pData);
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
          <ScatterPlotD3
            cohortData={cohortData}
            cohortEmbeddings={cohortEmbeddings}
            currState={currState}
            setCurrState={setCurrState}
          />
        </GridItem>
        <GridItem rowSpan={2} colSpan={2} className={'shadow'}>
          {'5'}
        </GridItem>
      </Grid>
    </ChakraProvider>
  );
}

export default App;
