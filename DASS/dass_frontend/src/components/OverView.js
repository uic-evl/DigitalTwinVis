import React, {useState, useEffect, useRef, Fragment} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';
import Button from 'react-bootstrap/Button';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import PatientScatterPlotD3 from './PatientScatterPlotD3.js';
import DoseEffectView from './DoseEffectView.js';
import SymptomPlotD3 from './SymptomPlotD3.js';
import Spinner from 'react-bootstrap/Spinner';
import PatientDoseView from './PatientDoseView.js';
import ClusterMetrics from './ClusterMetrics.js';
import RuleView from './RuleView.js';
import ClusterCVMetrics from './ClusterCVMetrics.js'

export default function OverView(props){
    const ref = useRef(null)

    const [viewToggle,setViewToggle] = useState(props.defaultState)

    const [xVar,setXVar] = useState('cluster_organ_pca1');
    const [yVar, setYVar] = useState('cluster_organ_pca2');
    const [sizeVar, setSizeVar] = useState('drymouth');

    //for x and y in the scatterplot
    const varOptions = [
        'cluster_organ_pca1','cluster_organ_pca2','cluster_organ_pca3',
        'dose_pca1','dose_pca2','dose_pca3',
        'symptom_all_pca1','symptom_all_pca2','symptom_all_pca3',
        'symptom_post_pca1','symptom_post_pca2','symptom_post_pca3',
        'symptom_treatment_pca1','symptom_treatment_pca2','symptom_treatment_pca3',
        'totalDose','tstage','nstage',
    ].concat(props.allSymptoms);
    //for shape stuff
    // const shapeOptions = [
    //     'tstage','nstage',
    // ].concat(symptoms)
    
    function makeDropdown(title,active,onclickFunc,key,options,dropDir,showState=true){
        if(options === undefined){
            options = varOptions;
        }
        let buttonOptions = options.map((d,i)=>{
            return (
                <Dropdown.Item
                    key={i+key}
                    value={d}
                    eventKey={d}
                    onClick={() => onclickFunc(d)}
                >{d}</Dropdown.Item>
            )
        })
        return (
            <DropdownButton
             className={'controlDropdownButton'}
             style={{'width':'auto'}}
             drop={dropDir}
             title={showState? title + ': ' + active: title}
             value={active}
             key={key}
             variant={'primary'}
            >{buttonOptions}</DropdownButton>
        )
    }

    function makeScatter(){
        if(props.clusterData != undefined & props.doseData != undefined){
            return (
                <>
                    <PatientScatterPlotD3
                        doseData={props.doseData}
                        clusterData={props.clusterData}
                        selectedPatientId={props.selectedPatientId}
                        setSelectedPatientId={props.setSelectedPatientId}
                        plotVar={props.plotVar}
                        clusterOrgans={props.clusterOrgans}
                        activeCluster={props.activeCluster}
                        setActiveCluster={props.setActiveCluster}
                        xVar={xVar}
                        yVar={yVar}
                        sizeVar={props.mainSymptom}
                        categoricalColors={props.categoricalColors}
                        svgPaths={props.svgPaths}
                        symptomsOfInterest={props.allSymptoms}
                        endpointDates={props.endpointDates}
                    ></PatientScatterPlotD3>
                </>
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

    function makePatientDoses(showCounterfactuals){
        if(props.clusterData != undefined & props.doseData != undefined){
            return (
                <PatientDoseView
                    doseData={props.doseData}
                    clusterData={props.clusterData}
                    selectedPatientId={props.selectedPatientId}
                    setSelectedPatientId={props.setSelectedPatientId}
                    plotVar={props.plotVar}
                    clusterOrgans={props.clusterOrgans}
                    activeCluster={props.activeCluster}
                    svgPaths={props.svgPaths}
                    mainSymptom={props.mainSymptom}
                    clusterFeatures={props.clusterFeatures}
                    symptomsOfInterest={props.symptomsOfInterest}
                    showCounterfactuals={showCounterfactuals}
                ></PatientDoseView>
            )
        }
    }

    function makeSymptomPlot(){
        //I'm maybe not doing this an putting it in the left hand side as a pernament view
        if(props.clusterData != undefined & props.doseData != undefined){
            return (
                <Col className={'noGutter shadow fillSpace'}>
                    <span className={'centerText viewTitle'}>
                        {
                            Utils.getVarDisplayName(props.mainSymptom) 
                            + ' Trajectory for cluster ' + (props.activeCluster) 
                            + ' vs everyone else'
                        }
                    </span>
                    <SymptomPlotD3
                        doseData={props.doseData}
                        clusterData={props.clusterData}
                        selectedPatientId={props.selectedPatientId}
                        setSelectedPatientId={props.setSelectedPatientId}
                        plotVar={props.plotVar}
                        clusterOrgans={props.clusterOrgans}
                        activeCluster={props.activeCluster}
                        setActiveCluster={props.setActiveCluster}
                        mainSymptom={props.mainSymptom}
                        categoricalColors={props.categoricalColors}
                    ></SymptomPlotD3>
                </Col>
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

    function makeEffectPlot(){
        if(props.clusterData != undefined & props.additiveClusterResults != undefined){
            return (
                    <DoseEffectView
                        doseData={props.doseData}
                        clusterData={props.clusterData}
                        additiveClusterResults={props.additiveClusterResults}
                        clusterOrgans={props.clusterOrgans}
                        clusterOrganCue={props.clusterOrganCue}
                        setClusterOrganCue={props.setClusterOrganCue}
                        activeCluster={props.activeCluster}
                        symptomsOfInterest={props.symptomsOfInterest}
                        mainSymptom={props.mainSymptom}
                        svgPaths={props.svgPaths}
                        additiveCluster={props.additiveCluster}
                        additiveClusterThreshold={props.additiveClusterThreshold}
                        setAdditiveCluster={props.setAdditiveCluster}
                        setAdditiveClusterThreshold={props.setAdditiveClusterThreshold}
                        nDoseClusters={props.nDoseClusters}
                        clusterFeatures={props.clusterFeatures}
                        showOrganLabels={props.showOrganLabels}
                        setShowOrganLabels={props.setShowOrganLabels}
                        endpointDates={props.endpointDates}
                    ></DoseEffectView>
            )
        } else{
            return (
                <Spinner 
                    as="span" 
                    animation = "border"
                    role='status'
                    className={'spinner'}/>
            )
        }
    }

    function makeCVMetricsPlot(){
        if(props.clusterData != undefined){
            return (
                <Container className={'noGutter fillSpace'}>
                    <ClusterCVMetrics
                        clusterData={props.clusterData}
                        plotVar={props.plotVar}
                        activeCluster={props.activeCluster}
                        setActiveCluster={props.setActiveCluster}
                        mainSymptom={props.mainSymptom}
                        categoricalColors={props.categoricalColors}
                        clusterMetricData={props.clusterMetricData}
                        clusterDataLoading={props.clusterDataLoading}
                        lrtConfounders={props.lrtConfounders}
                        endpointDates={props.endpointDates}
                        api={props.api}
                    ></ClusterCVMetrics>
                </Container>
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

    function makeMetricsPlot(){
        if(props.clusterData != undefined & props.doseData != undefined){
            return (
                <Container className={'noGutter fillSpace'}>
                    <ClusterMetrics
                        doseData={props.doseData}
                        api={props.api}
                        clusterData={props.clusterData}
                        selectedPatientId={props.selectedPatientId}
                        setSelectedPatientId={props.setSelectedPatientId}
                        plotVar={props.plotVar}
                        clusterOrgans={props.clusterOrgans}
                        activeCluster={props.activeCluster}
                        setActiveCluster={props.setActiveCluster}
                        symptomsOfInterest={props.symptomsOfInterest}
                        mainSymptom={props.mainSymptom}
                        categoricalColors={props.categoricalColors}
                        endpointDates={props.endpointDates}
                    ></ClusterMetrics>
                </Container>
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

    function makeRulePlot(){
        // if(props.ruleData != undefined & props.doseData != undefined){
        return (
            <RuleView
                api={props.api}
                clusterDataLoading={props.clusterDataLoading}
                doseData={props.doseData}
                svgPaths={props.svgPaths}
                mainSymptom={props.mainSymptom}
                clusterData={props.clusterData}
                activeCluster={props.activeCluster}
                clusterOrgans={props.clusterOrgans}
                selectedPatientId={props.selectedPatientId}
                setSelectedPatientId={props.setSelectedPatientId}
                categoricalColors={props.categoricalColors}
                endpointDates={props.endpointDates}
            ></RuleView>
        )
    }

    function switchView(view){
        if(view == 'scatterplot' | view === undefined | view === null){
            let buttonHeight = 20;
            return (
                <Row md={12} className={'noGutter fillSpace'}>
                    <Col className={'noGutter fillHeight'} md={9}>
                            {makeScatter()}
                    </Col>
                    <Col md={3} fluid={'false'} className={'noGutter fillHeight'}>
                        {makeDropdown('x-axis',xVar,setXVar,1,varOptions,'up')}
                        {makeDropdown('y-axis',yVar,setYVar,2,varOptions,'up')}
                    </Col>
                </Row>
            )
        } 
        if(view == 'effect'){
            return (
                <Row key={view} md={12} className={'noGutter fillSpace'}>
                    {makeEffectPlot()}
                </Row>
            )
        } 
        if(view == 'symptom'){
            return (
                <Fragment key={view}>
                    {makeSymptomPlot()}
                </Fragment>
            )
        } 
        if(view == 'patients'){
            return(
                <Row key={view} md={12} className={'noGutter fillSpace'}>
                    {makePatientDoses(true)}
                </Row>
            )
        }
        if(view == 'metric'){
            return (
                <Fragment key={view}>
                    {makeMetricsPlot()}
                </Fragment>
            )
        }
        if(view == 'rules'){
            return (
                <Row key={view} md={12} className={'noGutter fillSpace'}>
                    {makeRulePlot()}
                </Row>
            )
        }
        if(view == 'cv_metrics'){
            return (
                <Row key={view} md={12} className={'noGutter fillSpace'}>
                    {makeCVMetricsPlot()}
                </Row>
            )
        }
        return (<Spinner 
            as="span" 
            animation = "border"
            role='status'
            className={'spinner'}/>)
    }

    function makeToggleButton(value){
        let active = value === viewToggle;
        let variant = active? 'dark':'outline-secondary';
        let onclick = (e) => setViewToggle(value);
        return (
            <Button
                title={value+''}
                value={value}
                style={{'width':'auto'}}
                variant={variant}
                disabled={active}
                onClick={onclick}
            >{value+''}</Button>
        )
    }

    function makeSymptomDropdown(view){
        //there was an if statement before idk
        return makeDropdown(props.mainSymptom,true,props.setMainSymptom,10,props.symptomsOfInterest,'down',false)
    }

    function getPanelTitle(title){
        if(title === 'symptom'){
            return ''
        }
        if(title === 'effect'){
            return 'Effect of Adding/Removing Individual Organs on Cluster Metrics for Predicting ' + props.mainSymptom;
        }
        if(title == 'rules'){
            return 'Dose Threshold Rules for Approximating Clusters or Outcomes';
        }
        return Utils.getVarDisplayName(title);
    }
 
    const classes = props.className? props.className: 'overviewContainer';
    function getView(showToggleBar){
        if(showToggleBar){
            return (
                <div ref={ref} className={classes}>
                    <Row md={12} style={{'height': '1.5em'}} className={'noGutter fillWidth'}>
                        <Col md={8} className={'noGutter'}>
                            {makeToggleButton('scatterplot')}
                            {/* {makeToggleButton('effect')} */}
                            {makeToggleButton('symptom')}
                            {makeToggleButton('patients')}
                            {/* {makeToggleButton('metric')} */}
                            {/* {makeToggleButton('cv_metrics')} */}
                            {/* {makeToggleButton('rules')} */}
                        </Col>
                        <Col md={4}>
                            {makeSymptomDropdown(viewToggle)}
                        </Col>
                    </Row>
                    <Row md={12} 
                        className={'noGutter'}
                        style={{'height':'calc(100% - 1.5em)'}}
                    >
                        {switchView(viewToggle)}
                    </Row>
                </div> 
            )
        } else{
            return (
                <div ref={ref} className={classes}>
                   <Row md={12} style={{'height': '1.5em'}} className={'noGutter fillWidth'}>
                        <span className={'centerText viewTitle'} >
                            {getPanelTitle(viewToggle)}
                        </span>
                    </Row>
                    <Row md={12} 
                        className={'noGutter fillWidth'}
                        style={{'height':'calc(100% - 1.5em)'}}
                    >
                        {switchView(viewToggle)}
                    </Row>
                </div> 
            )
        }
    }
    let showToggle = (props.showToggle !== undefined)? props.showToggle: true;
    return getView(showToggle)
}
