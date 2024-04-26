import React, {useState, useEffect, useRef, Fragment} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import Dose2dCenterViewD3 from './Dose2dCenterViewD3.js';
import ClusterSymptomsD3 from './ClusterSymptomsD3.js';
import PatientDoseViewD3 from './PatientDoseViewD3.js';
import PatientSymptomsD3 from './PatientSymptomsD3.js'

import Spinner from 'react-bootstrap/Spinner';

export default function PatientDoseView(props){
    const ref = useRef(null)

    const plotVars = ['V35','V45','V55','V65'];
    const defaultSymptoms = ['drymouth','swallow','choke','pain'];
    const [plotSymptoms,setPlotSymptoms] = useState([...defaultSymptoms]);
    //temp limit on number of patients we plot
    //add in some sort of toggle or something here?
    const [maxPatients,setMaxPatients] = useState(10);

    const [neighborhoodData,setNeighborhoodData] = useState();
    const [counterfactualData,setCounterfactualData] = useState();

    const showCounterfactuals = (props.showCounterfactuals !== undefined)? props.showCounterfactuals:false;
    const [vizComponents,setVizComponents] = useState(
        <Spinner 
            as="span" 
            animation = "border"
            role='status'
            className={'spinner'}/>
    )

    const [compareVizComponents,setCompareVizComponents] = useState(
        <Spinner 
            as="span" 
            animation = "border"
            role='status'
            className={'spinner'}/>
    )

    function patientClinicalVector(d,doseCorrection=0){
        let valMap = {
            't1': 1/4,
            't2': 2/4,
            't3': 3/4,
            't4': 4/4,
            'n2a': 1/2,
            'n2b': 1/2,
            'n2c': 2/2,
            'n3': 2/2,
        }
        function fromMap(v){
            let val = valMap[v];
            if(val === undefined){ val = 0; }
            return val
        }
        let tVal = fromMap(d.t_stage);
        let nVal = fromMap(d.n_stage);
        let hpvVal = parseInt(d.hpv);
        let ic = parseInt(d.ic);
        let rt = parseInt(d.rt);
        let concurrent = parseInt(d.concurrent);
        let bot = (d.subsite == 'BOT')? 1:0;
        let tonsil = (d.subsite == 'Tonsil')? 1:0;
        let totalDoseRatio = parseFloat(d.totalDose)*doseCorrection;
        return [tVal,nVal,hpvVal,ic,rt,concurrent,bot,tonsil,totalDoseRatio]
        // return [tVal,nVal,hpvVal,ic,rt,concurrent,bot,tonsil]
    }

    function patientClusterFeatureVector(d,doseCorrection=70){
        var vector = [];
        for(let f of props.clusterFeatures){
            let vals = d[f];
            if(vals === undefined){continue;}
            //they should be all arrays but in case it's a straight up number
            for(let v of vals){
                vector.push(v/doseCorrection);
            }
        }
        return vector
    }

    function patientCompositeVector(d,doseCorrection=0){
        let v1 = patientClusterFeatureVector(d);
        let v2 = patientClinicalVector(d,doseCorrection);
        for(let v of v2){
            v1.push(v);
        }
        return v1;
    }
    
    function patientSim(a,b){
        var dist = 0;
        for(let i in a){
            let diff = (b[i] - a[i])**2;
            dist += diff
        }
        dist = dist**.5;
        return 1/(1+dist)
    }
    
    function getSimilarPatients(sourcePatient,targetPatients,useClusterFeatures=true,useClinicalFeatures=true){
        var getVect = (d,correction=0) => {
            if(useClusterFeatures){
                if(useClinicalFeatures){
                    return patientCompositeVector(d,correction);
                } else{
                    return patientClusterFeatureVector(d);
                }
            } else{
                return patientClinicalVector(d,correction);
            }
        }
        let dCorrection = 2/parseFloat(sourcePatient.totalDose)
        let source = getVect(sourcePatient,dCorrection);
        let sims = []
        for(let t of targetPatients){
            let target = getVect(t,dCorrection);
            let sim = patientSim(source,target);
            let entry = Object.assign({},t)
            entry.plotSimilarity = sim;
            sims.push(entry)
        }
        sims.sort((a,b) => b.plotSimilarity - a.plotSimilarity)
        return sims
    }

    useEffect(()=>{
        let newSymptoms = [props.mainSymptom];
        for(let s of defaultSymptoms){
            if(s != props.mainSymptom){newSymptoms.push(s);}
        }
        setPlotSymptoms(newSymptoms);
    },[props.mainSymptom])

    useEffect(function getSimLists(){
        if(props.doseData !== undefined & props.clusterData !== undefined & props.activeCluster !== undefined){
            let activeIds = props.clusterData.filter(x => x.clusterId == props.activeCluster).map(x=>x.ids)[0];
            //get data in selected cluster
            //data for second column
            if(activeIds === undefined){
                return
            }
            let toCompare = parseInt(props.selectedPatientId);
            if(toCompare === undefined | toCompare < 0){
                toCompare = parseInt(activeIds[0]);
            }
            let selectedData = props.doseData.filter(x => parseInt(x.id) === toCompare)[0];

            let inCluster = props.doseData.filter(x => activeIds.indexOf(x.id) > -1);
            let neighbors = getSimilarPatients(selectedData,inCluster).filter(d=>d !== undefined);
            setNeighborhoodData(neighbors);

            if(showCounterfactuals){
                let compareCandidates = props.doseData.filter(x => activeIds.indexOf(x.id) == -1);
                let counterfactuals = getSimilarPatients(selectedData,compareCandidates).filter(d=>d !== undefined);
                setCounterfactualData(counterfactuals);
            }
        }
    },[props.doseData,props.clusterData,props.clusterFeatures,props.activeCluster,props.selectedPatientId])

    useEffect(function drawPatients(){
        function makePatientPlot(d,i,canClick=true,baseline){
            let title = "ID:" + d.id + ' ';
            let trueString = d => (parseInt(d)>0)? '+':'-';
            let bottomTitle = d.t_stage + '|' + d.n_stage + '|hpv' +trueString(d.hpv) + '|' + d.subsite + '|rt' + trueString(d.rc) + '|ic' + trueString(d.ic);
            let handlePatientSelect = (pid) => {
                if(!canClick){ return; }
                let p = parseInt(pid);
                if(parseInt(props.selectedPatientId) !== p){
                    props.setSelectedPatientId(p);
                }
            }
            let active = parseInt(d.id) == parseInt(props.selectedPatientId);
            // active = (active & canClick)
            let variant = active? 'dark': 'outline-secondary';
            let getColor = d3.interpolateReds;
            if(baseline !== undefined){
                getColor = d3.interpolateGnBu;
            }
            let width = showCounterfactuals? '48%':'90%'
            return (
                <Container id={'pdose'+d.id} key={d.id+'_'+props.selectedPatientId} 
                style={{'height':'auto','width': width,'marginTop': '1em','minHeight':'4em'}} 
                    className={'inline shadow'} key={i+props.plotVar+canClick} md={5}>
                    <span  className={'controlPanelTitle'}>
                        <Button
                            title={title}
                            value={d}
                            variant={variant}
                            disabled={active}
                            onClick={(e)=>handlePatientSelect(d.id)}
                        >{title}<span r={10} style={{'borderRadius':'70%','color':d.color}}>{'⬤'}</span></Button>
                    </span>
                    <Row style={{'height':'var(--patient-dose-height)','minHeight':'2em'}}>
                        <PatientDoseViewD3
                            data={d}
                            key={i+''+props.activeCluster+'dose'}
                            plotVar={props.plotVar}
                            svgPaths={props.svgPaths}
                            orient={'both'}
                            getColor={getColor}
                            baseline={baseline}
                        ></PatientDoseViewD3>
                    </Row>
                    <Row style={{'height':'var(--patient-symptom-height)','minHeight':'2em'}}>
                        <PatientSymptomsD3
                            data={d}
                            key={i+''+props.activeCluster+'symptom'}
                            plotSymptoms={plotSymptoms}
                            // plotSymptoms={props.symptomsOfInterest}
                        ></PatientSymptomsD3>
                    </Row>
                    <span  className={'controlPanelTitle'}>
                        <Button
                            title={bottomTitle}
                            value={d}
                            variant={''}
                            disabled={true}
                        >{bottomTitle}</Button>
                    </span>
                </Container>
            )
        }

        if(props.svgPaths != undefined &  neighborhoodData !== undefined){
            
            let selectedData = undefined;
            if(props.doseData !== undefined & props.selectedPatientId !== undefined){
                selectedData = props.doseData.filter(x => parseInt(x.id) === parseInt(props.selectedPatientId))[0];
            }
            let neighbors = neighborhoodData.slice(0,Math.min(neighborhoodData.length-1, maxPatients));
            let components = neighbors.map( (d,i) => makePatientPlot(d,i,true) )
            setVizComponents(components);
            
            if(counterfactualData !== undefined){
                let counterfactuals = counterfactualData.slice(0,Math.min(counterfactualData.length-1, maxPatients));
                let compareComponents = counterfactuals.map((d,i) => makePatientPlot(d,i,false))
                setCompareVizComponents(compareComponents);
            }

        } else{
            let temp = [1,1,1,1,1,1,1]
            let components = temp.map((d,i)=>{
                return (
                    <Spinner 
                    as="span" 
                    key={i}
                    animation = "border"
                    role='status'
                    className={'spinner'}/>
                )
            });
            setVizComponents(components);
            setCompareVizComponents(components.map(x=>x))
        }
    },[props.svgPaths,
        props.plotVar,props.activeCluster,
        showCounterfactuals,maxPatients,
        neighborhoodData,counterfactualData,
        plotSymptoms,
        // props.symptomsOfInterest
    ])
    
    const addPatientsButtons = (
        <Row md={12} style={{'marginTop':'2em'}}>
            <Col md={6}>
                <Button
                    title={'show Less'}
                    variant={(maxPatients > 5)? 'outline-secondary':'secondary'}
                    disabled={maxPatients <= 5}
                    onClick={(e)=>setMaxPatients(Math.max(5,maxPatients-5))}
                >{'show less'}</Button>
            </Col>
            <Col md={6}>
            <Button
                title={'show more'}
                variant={'outline-secondary'}
                onClick={(e)=>setMaxPatients(Math.min(250,maxPatients+5))}
            >{'show more'}</Button>
            </Col>
        </Row>
    )
    //adjust height if I change how the layout is 
    let scrollStyle = {'margin':'0px','height': '45vh','width': '100%','overflowY':'scroll','padding':'0px'};
    let scrollStyle2 = {'margin':'0px','height': '45vh','overflowY':'scroll','padding':'0px'};
    if(!showCounterfactuals){
        return ( 
            //so I need to set the hieght manually in case I need to adjust this
            <div ref={ref} 
            style={scrollStyle} >
                {vizComponents}
                {addPatientsButtons}
            </div> 
            )
    } else{
        return ( 
            //so I need to set the hieght manually in case I need to adjust this
            <div ref={ref} >
                <Row md={12} style={{'overflowY':'show','height':'auto'}} className={'noGutter fillSpace'}>
                    <Col md={6} style={scrollStyle2} className={'noGutter scroll'}>
                        {vizComponents}
                        {addPatientsButtons}
                    </Col>
                    <Col md={6} style={scrollStyle2}  className={'noGutter scroll'}>
                        {compareVizComponents}
                        {addPatientsButtons}
                    </Col>
                </Row>
                
            </div> 
            )
    }
}

