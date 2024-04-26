import React, {useState, useEffect, useRef} from 'react';
// import Utils from '../modules/Utils.js';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import ClusterCVMetricsD3 from './ClusterCVMetricsD3.js'
import Spinner from 'react-bootstrap/Spinner';


export default function ClusterCVMetrics(props){
    const ref = useRef(null)

    const [vizComponents,setVizComponents] = useState(
        <Spinner 
            as="span" 
            animation = "border"
            role='status'
            className={'spinner'}/>
    )

    //I dont think I use this
    const [clusterMetricData,setClusterMetricData] = useState(null);
    const modelTypeOptions = ['regression','forest','adaboost_forest','adaboost_regression','linear_svm','rbf_svm']
    const [metricsModelType,setMetricsModelType] = useState('regression');
    const metrics = ['roc','precision','recall','f1','f2','mcc'];

    var fetchClusterMetrics = async(cData,lrtConfounders,symptom,mType,dates)=>{
        if(cData !== undefined & !props.clusterDataLoading){
            setClusterMetricData(undefined);
            props.api.getClusterMetrics(cData,lrtConfounders,symptom,mType,dates).then(response =>{
            // console.log('cluster metric data',response)
            setClusterMetricData(response);
          }).catch(error=>{
            console.log('cluster metric data error',error);
          })
        }  
      }


    useEffect(()=>{
        if(!props.clusterDataLoading & props.clusterData !== undefined & props.clusterData !== null){
            fetchClusterMetrics(props.clusterData, props.lrtConfounders,props.mainSymptom,metricsModelType,props.endpointDates);
        }
      },[props.clusterDataLoading,props.clusterData,props.mainSymptom,props.lrtConfounders,metricsModelType,props.endpointDates]);
      

    function makeMetricPlot(key){
        return (
            <Col
            md={6}
            key={key+props.mainSymptom}
            className={'noGutter'}
            style={{'display':'inline-block','padding':0,'width':'50%','height': '12em','marginBottom':'1em'}}>
                <ClusterCVMetricsD3
                    clusterData={props.clusterData}
                    metric={key}
            
                    activeCluster={props.activeCluster}
                    setActiveCluster={props.setActiveCluster}
                    mainSymptom={props.mainSymptom}
                    categoricalColors={props.categoricalColors}
                    clusterMetricData={clusterMetricData}
                ></ClusterCVMetricsD3>
            </Col>
        )
    }
    useEffect(function makePlots(){
        if(clusterMetricData !== undefined & clusterMetricData !== null){
            let components = metrics.map(makeMetricPlot);
            setVizComponents(components);
        } else{
            setVizComponents(<Spinner 
                as="span" 
                animation = "border"
                role='status'
                className={'spinner'}/>)
        }
    },[clusterMetricData,props.mainSymptom,props.activeCluster,props.clusterData])

    function makeMetricToggleOptions(){
        const buttons = modelTypeOptions.map((o) => {
            return (
                <Button
                    key={o+'btn'}
                    variant={ (o===metricsModelType)? 'dark':'outline-secondary'}
                    onClick={()=>{ if(metricsModelType !== o) {setMetricsModelType(o);} }}
                >{o.replace('_',' ')}</Button>
            )
        })
        return (
            <span>
                <Button
                variant={'light'}
                >{'Model:'}</Button>
                {buttons}
            </span>
        )
    }
    return ( 
        <div ref={ref} id={'doseClusterContainer'}>
            <Container md={12} className = {'noGutter fillWidth'} style={{'height':'45vh'}}>
                <Row md={12} style={{'height': '3em'}}>
                    {makeMetricToggleOptions()}
                </Row>
                <Row md={12} className={'scroll'} style={{'height': 'calc(45vh - 2.2em)'}}>
                    {vizComponents}
                </Row>
                
            </Container>
            
        </div> 
        )
}
