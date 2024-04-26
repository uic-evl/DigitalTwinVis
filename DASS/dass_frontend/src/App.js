

import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import * as constants from './modules/Constants.js';
import { Spinner } from 'react-bootstrap';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Button from 'react-bootstrap/Button';
import { Fragment } from 'react';

import * as d3 from 'd3';

import React, {useEffect, useState} from 'react';
import DataService from './modules/DataService';
import Utils from './modules/Utils';
import DoseView from './components/DoseView.js';
import ClusterControlPanel from './components/ClusterControlPanel.js';
import DoseEffectView from './components/DoseEffectView.js';
import SymptomPlotD3 from './components/SymptomPlotD3.js';
import PatientScatterPlotD3 from './components/PatientScatterPlotD3.js';

import ClusterMetrics from './components/ClusterMetrics.js';
import RuleView from './components/RuleView.js';

import { makeTipLrtChart, makeTipChart} from './modules/Tooltip.js';

import HelpButton from './modules/HelpButton.js';


function App() {
  var api = new DataService();
  //data with entries for each patient
  const [doseData,setDoseData] = useState(null);
  //agregated data with stats for each cluster ,including ids
  const [clusterData,setClusterData] = useState(null);
  //organs used to cluster the patients
  const [clusterOrgans,setClusterOrgans] = useState([
    'Hard_Palate',
    'Rt_Parotid_Gland','Lt_Parotid_Gland',
    'Rt_Submandibular_Gland','Lt_Submandibular_Gland',
  ])
  //used to hold the organs we select for the next time we query the clustering
  const [clusterOrganCue,setClusterOrganCue] = useState([])
  //used to check if we're waiting for new clusters so we don't query anything else in the meaning
  const [clusterDataLoading, setClusterDataLoading] = useState(false);
  //# of clusters used
  const [nDoseClusters,setNDoseClusters] = useState(3);
  //which dose features we use for each organ
  const [clusterFeatures,setClusterFeatures] = useState(['V25','V30','V35','V40','V45','V50','V55','V60']);
  const [tempClusterFeatures,setTempClusterFeatures] = useState();
  //used to determine the confounders used in the models for determining p-values
  const [lrtConfounders,setLrtConfounders] = useState([
    't_severe',
    'n_severe',
    'hpv',
    'BOT','Tonsil',
    'age_65',
    'Parotid_Gland_limit',
    'performance_1','performance_2',
  ]);

  const [endpointDates,setEndpointDates] = useState([33]);
  //which variable is being ploted when showing patient dose distirbutions
  const [plotVar,setPlotVar] = useState('V55');

  //in progress, should toggle if the dose cluster show labels for organs?
  const [showOrganLabels,setShowOrganLabels] = useState(true);
  //which cluster is the focus on in the detail views
  const [activeCluster,setActiveCluster] = useState(nDoseClusters-1);
  // const [updateCued,setUpdateCued] = useState(false)
  //which patient is focused on in detail views when appropriate
  const [selectedPatientId, setSelectedPatientId] = useState(-1);
  //what type of clustering to use.  bgmm = bayesian gaussian mixutre model.
  const [clusterType,setClusterType] = useState('bgmm');
  //wheter to show one or both sides of the head in the dose diagram.  probably should always be true
  const [showContralateral,setShowContralateral] = useState(true);
  //data results from testin the effects of other organs on clustering results
  const [additiveClusterResults,setAdditiveClusterResults] = useState(null);
  const [additiveClusterThreshold,setAdditiveClusterThreshold] = useState(5);
  //false = use highest dose cluster, ture = use all clusters
  const [additiveCluster, setAdditiveCluster] = useState(false);
  
  //which symptoms we're including in the plots
  //currently used for dropdown outcome selection + the tooltip for individual patients
  const [symptomsOfInterest,setSymptomsOfInterest] = useState([
    'drymouth',
    // 'salivary_mean',
    // 'salivary_max',
    'taste',
    'swallow',
    'voice',
    'mucus',
    'mucositis',
    'choke',
    'pain',
    'teeth',
    // 'throat_mean',
    // 'throat_max',
    // 'mouth_max',
    // 'mouth_mean',
    // 'core_mean',
    // 'core_max',
    // 'interference_mean',
    // 'interference_max',
    // 'hnc_mean',
    // 'hnc_max',
  ]);
  //all possible symptoms I coded into the data
  const allSymptoms = [
    'drymouth',
    'salivary_mean',
    'salivary_max',
    'throat_mean',
    'throat_max',
    'mouth_max',
    'mouth_mean',
    'core_mean',
    'core_max',
    'interference_mean',
    'interference_max',
    'hnc_mean',
    'hnc_max',
    'teeth',
    'taste',
    'swallow',
    'choke',
    'voice',
    'mucus',
    'mucositis',
    'nausea',
    'vomit',
    'appetite',
    'pain',
  ]
  const [mainSymptom,setMainSymptom] = useState('drymouth');
  
  //this is theoreticall better than static 100 in case it goes really high?
  const [maxDose, setMaxDose] = useState(100);

  const doseScale = d3.scaleLinear()
    .domain([0,maxDose/2,maxDose])
    .range([0,.5,1]);
    
  // const doseColor = d3.scaleLinear()
  //   .domain([0,.5,1])
  //   .range(['white','#bf4d7c','#8a063d'])
  const doseColor = d3.interpolateReds;


  //hnc diagram svg patths
  const [svgPaths,setSvgPaths] = useState();
  const [xVar,setXVar] = useState('cluster_organ_pca1');
  const [yVar, setYVar] = useState('cluster_organ_pca2');
  const [showTemporalSymptoms,setShowTemporalSymptoms] = useState(true);
  //this use to be d3.scaleOrdinal but it wasn't wokring for some reason
  //returns color based on index bascially
  const categoricalColors = (i) => {
    let colors = [
    '#386cb0',
    '#fdc086',
    // '#1ecbe1',
    '#7fc97f',
    // '#ffff99',
    '#e7298a',
    '#e6ab02',
    '#999999',
    '#666666'
  ];
    let ii = Math.round(i);
    if(ii < 0 | ii > colors.length - 1){
      return 'black';
    }
    return colors[ii];
  }

  const parameterColors = {
    current: 'brown',
    cue: 'teal',
    both: 'black',
    none: 'white',
  }

  
  function resetSelections(){
    setActiveCluster(nDoseClusters-1);
    setSelectedPatientId(-1);
  }

  function updateClusterOrgans(){
    if(!clusterDataLoading & clusterData !== undefined){

      let cue = [];
      for(let o of clusterOrganCue){ cue.push(o); }
      if(cue.length > 0){
        // console.log('new cluster organs',cue)
        setClusterOrgans(cue);
      }
    }
  }

  function addOrganToCue(org){
    //There is a copy of this in DoseEffectView that needs seperate updating
    //transfering it down doest update it properly for some reason I checked
    if(clusterData !== undefined & org !== undefined & constants.ORGANS_TO_SHOW.indexOf(org) >= 0){
      let newCue = [];

      for(let o of clusterOrganCue){ newCue.push(o); }

      if(clusterOrganCue.length < 1 | clusterOrganCue.indexOf(org) < 0){
        newCue.push(org);
        setClusterOrganCue(newCue);
      } else{
        newCue = newCue.filter(x=>x!==org);
        setClusterOrganCue(newCue);
      }
    }
  }

  useEffect(()=>{
      let features = [];
      for(let f of clusterFeatures){ features.push(f);}
      setTempClusterFeatures(features);
  },[clusterFeatures]);


  useEffect(()=>{
      fetch('organ_svgs/organ_svg_paths.json').then((newPaths)=>{
          newPaths.json().then((data)=>{
              setSvgPaths(data);
          })
      })
  },[])

  const tipChartSize = [170,120];
  const tipSymptomChartSize = [160,15];//height is for each symptom here
  const makeTTipChart = (e,d,key) => makeTipChart(e,d,tipChartSize, svgPaths, plotVar, doseColor,doseScale, key);
  const makeTTipLrtChart = (e,d) => makeTipLrtChart(e,d, tipSymptomChartSize, symptomsOfInterest);
  

  var fetchDoseData = async(orgs,cFeatures) => {
    const response = await api.getDoseJson(orgs,cFeatures);
    setDoseData(response.data);
  }

  var fetchDoseClusters = async(org,nClust,clustFeatures,clusterType,confounders,symptoms,dates) => {
    setClusterData();
    setClusterDataLoading(true);
    // console.log('clustering with organs', org)
    const response = await api.getDoseClusterJson(org,nClust,clustFeatures,clusterType,confounders,symptoms,dates);
    // console.log('cluster data',response.data);
    setClusterData(response.data);
    setClusterDataLoading(false);
    resetSelections();
  }

  var fetchAdditiveEffects= async(org,nClust,clustFeatures,clusterType,symp,lrtConfounders,thresholds,useAllClusters,dates) => {
    setAdditiveClusterResults(undefined);
    // console.log('aadditive clusters',clusters)
    if(clusterDataLoading){ return; }
    var clusters;
    if(useAllClusters){
      clusters = [-1];
    } else{
      clusters = [nDoseClusters-1]
    }
    const response = await api.getAdditiveOrganClusterEffects(
      org,
      nClust,
      clustFeatures,
      clusterType,
      symp,
      lrtConfounders,
      thresholds,
      clusters,
      dates,
    );
    // console.log('fetched addtive',response.data);
    setAdditiveClusterResults(response.data);
  }



  useEffect(() => {

    fetchDoseData(clusterOrgans,clusterFeatures);
    fetchDoseClusters(clusterOrgans,nDoseClusters,clusterFeatures,clusterType,lrtConfounders,symptomsOfInterest,endpointDates);
    fetchAdditiveEffects(clusterOrgans,nDoseClusters,clusterFeatures,clusterType,mainSymptom,lrtConfounders,[additiveClusterThreshold],additiveCluster,endpointDates);
  },[])


  useEffect(() => {
    if(clusterData !== undefined & clusterData !== null){
      // console.log('cluster organ query', clusterOrgans)
      fetchDoseClusters(clusterOrgans,nDoseClusters,clusterFeatures,clusterType,lrtConfounders,symptomsOfInterest,endpointDates);
    }
  },[clusterOrgans,nDoseClusters,
    clusterFeatures,
    clusterType])

  useEffect(function updateDoses(){
    if(!clusterDataLoading & clusterData !== undefined){
      fetchDoseData(clusterOrgans,clusterFeatures)
    }
  },[clusterOrgans,clusterFeatures,clusterData,clusterDataLoading])

  // useEffect(function clearCue(){
  //   setClusterOrganCue(new Array());
  // },[clusterOrgans])

  useEffect(function updateEffect(){
    if(clusterData !== undefined & !clusterDataLoading){
      fetchAdditiveEffects(clusterOrgans,nDoseClusters,clusterFeatures,clusterType,mainSymptom,lrtConfounders,[additiveClusterThreshold],additiveCluster,endpointDates);
    }
  },[clusterDataLoading,clusterData,mainSymptom,clusterDataLoading,lrtConfounders,additiveClusterThreshold,additiveCluster,endpointDates])


  function makeEffectPlot(){
    return (
            <DoseEffectView
                doseData={doseData}
                clusterData={clusterData}
                tempClusterFeatures={tempClusterFeatures}
                setTempClusterFeatures={setTempClusterFeatures}
                additiveClusterResults={additiveClusterResults}
                clusterOrgans={clusterOrgans}
                clusterOrganCue={clusterOrganCue}
                setClusterOrganCue={setClusterOrganCue}
                clusterFeatures={clusterFeatures}
                setClusterFeatures={setClusterFeatures}
                activeCluster={activeCluster}
                symptomsOfInterest={symptomsOfInterest}
                mainSymptom={mainSymptom}
                setMainSymptom={setMainSymptom}
                svgPaths={svgPaths}
                additiveCluster={additiveCluster}
                additiveClusterThreshold={additiveClusterThreshold}
                setAdditiveCluster={setAdditiveCluster}
                setAdditiveClusterThreshold={setAdditiveClusterThreshold}
                nDoseClusters={nDoseClusters}
                showOrganLabels={showOrganLabels}
                setShowOrganLabels={setShowOrganLabels}
                endpointDates={endpointDates}
                parameterColors={parameterColors}
            ></DoseEffectView>
          )
  }

  function makeMetricPlot(){
      if(clusterData != undefined & doseData != undefined){
          return (
              <ClusterMetrics
                  doseData={doseData}
                  api={api}
                  clusterData={clusterData}
                  selectedPatientId={selectedPatientId}
                  setSelectedPatientId={setSelectedPatientId}
                  plotVar={plotVar}
                  clusterOrgans={clusterOrgans}
                  activeCluster={activeCluster}
                  setActiveCluster={setActiveCluster}
                  symptomsOfInterest={symptomsOfInterest}
                  mainSymptom={mainSymptom}
                  categoricalColors={categoricalColors}
                  endpointDates={endpointDates}
              ></ClusterMetrics>
          )
      } else{
          return (<Spinner 
              as="span" 
              animation = "border"
              role='status'
              className={'spinner'}/>
          );
      }
  }

  function makeSymptomPlot(){
      //I'm maybe not doing this an putting it in the left hand side as a pernament view
      if(clusterData != undefined & doseData != undefined){
          return (
                  <SymptomPlotD3
                      doseData={doseData}
                      clusterData={clusterData}
                      selectedPatientId={selectedPatientId}
                      setSelectedPatientId={setSelectedPatientId}
                      plotVar={plotVar}
                      clusterOrgans={clusterOrgans}
                      activeCluster={activeCluster}
                      setActiveCluster={setActiveCluster}
                      mainSymptom={mainSymptom}
                      categoricalColors={categoricalColors}
                  ></SymptomPlotD3>
          )
      } else{
          return (<Spinner 
              as="span" 
              animation = "border"
              role='status'
              className={'spinner'}/>
          );
      }
  }

  function makeOutcomeView(showSymptomView){
    let outcomeView = showSymptomView? makeSymptomPlot: makeMetricPlot;
    return (
      <Row md={12} className={'fillSpace noGutter'}>
        <Row md={12} className={'centerText noGutter'} style={{'height':'1.2em'}}>
          <Col>
            <Button 
              title={'Symptom Trajectory'}
              onClick={() => setShowTemporalSymptoms(true)}
              disabled={showTemporalSymptoms}
              variant={showTemporalSymptoms? 'dark':'outline-secondary'}
            >{'Symptom Trajectory'}</Button>
            <Button 
              title={'Cluster-Outcome Correlations'}
              onClick={() => setShowTemporalSymptoms(false)}
              disabled={!showTemporalSymptoms}
              variant={!showTemporalSymptoms? 'dark':'outline-secondary'}
            >{'Cluster-Outcome Correlations'}</Button>
          </Col>
        </Row>
        <Row md={12} className={'fillWidth'} style={{'height':'calc(100% - 2em)'}}>
          <div style={{'width':'100%','height':'100%'}}>
          {outcomeView()}
          </div>
        </Row>
      </Row>
    )
  }

  function makeRulePlot(){
    // if(props.ruleData != undefined & props.doseData != undefined){
      return (
          <RuleView
              api={api}
              clusterDataLoading={clusterDataLoading}
              doseData={doseData}
              svgPaths={svgPaths}
              mainSymptom={mainSymptom}
              clusterData={clusterData}
              activeCluster={activeCluster}
              clusterOrgans={clusterOrgans}
              selectedPatientId={selectedPatientId}
              setSelectedPatientId={setSelectedPatientId}
              categoricalColors={categoricalColors}
              endpointDates={endpointDates}

              plotVar={plotVar}
              symptomsOfInterest={symptomsOfInterest}
              makeTTipChart={makeTTipChart}
              makeTTipLrtChart={makeTTipLrtChart}
          ></RuleView>
      )
  }

  function makeDropdown(title,active,onclickFunc,key,options,dropDir,showState=true){
      let buttonOptions = options.map((d,i)=>{
          return (
              <Dropdown.Item
                  key={i+key}
                  value={Utils.getVarDisplayName(d)}
                  eventKey={d}
                  onClick={() => onclickFunc(d)}
              >{Utils.getVarDisplayName(d)}</Dropdown.Item>
          )
      })
      let name = Utils.getVarDisplayName(active + '');
      if(title !== ''){
        name = showState? title + ': ' + active: title;
      } 
      return (
          <DropdownButton
          className={'controlDropdownButton'}
          style={{'width':'auto'}}
          drop={dropDir}
          title={name}
          value={active}
          key={key}
          variant={'primary'}
          >{buttonOptions}</DropdownButton>
      )
  }

  function makeScatter(){
      if(clusterData != undefined & doseData != undefined){
          return (
              <Fragment key={clusterOrgans.join('')+ clusterFeatures.join('')}>
                  <PatientScatterPlotD3
                      doseData={doseData}
                      doseColor={doseColor}
                      clusterData={clusterData}
                      selectedPatientId={selectedPatientId}
                      setSelectedPatientId={setSelectedPatientId}
                      clusterOrgans={clusterOrgans}
                      activeCluster={activeCluster}
                      setActiveCluster={setActiveCluster}
                      xVar={xVar}
                      yVar={yVar}
                      sizeVar={mainSymptom}
                      categoricalColors={categoricalColors}
                      svgPaths={svgPaths}
                      symptomsOfInterest={allSymptoms}
                      endpointDates={endpointDates}
                      makeTTipChart={makeTTipChart}
                      makeTTipLrtChart={makeTTipLrtChart}
                  ></PatientScatterPlotD3>
              </Fragment>
          )
      } else{
          return (<Spinner 
              as="span" 
              animation = "border"
              role='status'
              className={'spinner'}/>
          );
      }
  }

  function makeScatterPlot(){
    const varOptions = [

      'cluster_organ_pca1','cluster_organ_pca2','cluster_organ_pca3',
      'dose_pca1','dose_pca2','dose_pca3',
      'symptom_all_pca1','symptom_all_pca2','symptom_all_pca3',
      'symptom_post_pca1','symptom_post_pca2','symptom_post_pca3',
      'symptom_treatment_pca1','symptom_treatment_pca2','symptom_treatment_pca3',
      'totalDose','tstage','nstage',
    ].concat(allSymptoms);
    return (
      <div className={'fillSpace noGutter'}>
          <Row style={{'height':'1.5em'}} className={'viewTitle centerText noGutter'} md={12}>
            <span>
              {"Scatterplot of "}
              {makeDropdown('',xVar,setXVar,1,varOptions,'down')}
              {' vs '}
              {makeDropdown('',yVar,setYVar,2,varOptions,'down')}
              </span>
          </Row>
          <Row style={{'height':'calc(100% - 2.5em)'}} 
          className={'noGutter'} 
          md={12}>
                  {makeScatter()}
          </Row>
      </div>
    ) 
  }

  function makeClusterDosePlot(){
    return(<DoseView
        doseData={doseData}
        clusterData={clusterData}
        clusterOrgans={clusterOrgans}
        addOrganToCue={addOrganToCue.bind(this)}
        clusterOrganCue={clusterOrganCue}
        nDoseClusters={nDoseClusters}
        plotVar={plotVar}
        setPlotVar={setPlotVar}
        svgPaths={svgPaths}
        activeCluster={activeCluster}
        setActiveCluster={setActiveCluster}
        symptomsOfInterest={symptomsOfInterest}
        showContralateral={showContralateral}
        categoricalColors={categoricalColors}
        mainSymptom={mainSymptom}
        setMainSymptom={setMainSymptom}
        showOrganLabels={showOrganLabels}
        setShowOrganLabels={setShowOrganLabels}
        doseColor={doseColor}
        endpointDates={endpointDates}
        setEndpointDates={setEndpointDates}
        maxDose={maxDose}
        setMaxDose={setMaxDose}
        parameterColors={parameterColors}
    ></DoseView>)
  }

  return (
    <div className="App">

        <Container className={'fillSpace noGutter'} lg={12}>
          <Row id={'clusterControlPanelContainer'} lg={12}>
                <ClusterControlPanel
                  nDoseCluster={nDoseClusters}
                  setNDoseClusters={setNDoseClusters}
                  clusterFeatures={clusterFeatures}
                  setClusterFeatures={setClusterFeatures}
                  tempClusterFeatures={tempClusterFeatures}
                  setTempClusterFeatures={setTempClusterFeatures}
                  clusterDataLoading={clusterDataLoading}
                  setClusterDataLoading={setClusterDataLoading}
                  updateClusterOrgans={updateClusterOrgans}
                  plotVar={plotVar}
                  setPlotVar={setPlotVar}
                  clusterType={clusterType}
                  mainSymptom={mainSymptom}
                  setMainSymptom={setMainSymptom}
                  setClusterType={setClusterType}
                  symptomsOfInterest={symptomsOfInterest}
                  setSymptomsOfInterest={setSymptomsOfInterest}
                  lrtConfounders={lrtConfounders}
                  setLrtConfounders={setLrtConfounders}
                  showContralateral={showContralateral}
                  setShowContralateral={setShowContralateral}
                  allSymptoms={allSymptoms}
                  showOrganLabels={showOrganLabels}
                  setShowOrganLabels={setShowOrganLabels}
                  doseColor={doseColor}
                  maxDose={maxDose}
                  endpointDates={endpointDates}
                  setEndpointDates={setEndpointDates}
                ></ClusterControlPanel>
          </Row>
          <Row id={'mainVis'} className={'noGutter'} lg={12}>   
            <Row lg={12} style={{
              'width':'100%',
              'height':'calc(var(--cluster-height) + 6em)'
              }}>
              <Col md={4} style={{'height':'100%','marginTop':'1em'}} className={'shadow'}>
                {makeEffectPlot()}
              </Col>
              <Col md={8} style={{'height':'100%'}} md={8}>
                {makeClusterDosePlot()}
              </Col>
            </Row>
            <Row lg={12} 
            style={{
              'marginTop':'2em',
              'width':'100%',
              'margin':'2vw!important',
              'height':'calc(100% - var(--cluster-height) - 6em - 2em)',
              }}>
              <Col 
              className={'shadow'}
              style={{
                'height':'100%',
                'width': 'calc(100% - 25vw - 20vw - 4vw)',
              }}>
                {makeOutcomeView(showTemporalSymptoms)}
              </Col>
              <Col 
                className={'shadow'}
                style={{
                  'height':'100%',
                  'width': '23vw',
              }}>
                {makeScatterPlot()}
              </Col>
              <Col 
              style={{
                'height':'100%',
                'width': '22vw',
              }}>
                {makeRulePlot()}
              </Col>
            </Row>
          </Row>
      </Container>
    </div>
  );
}

export default App;
