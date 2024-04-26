import React, {useState, useEffect} from 'react';

// import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"

import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';

export default function ClusterControlPanel(props){

    const plotVarOptions = constants.DVH_KEYS.slice();
    const nClusterOptions = [2,3,4,5,6,7,8];
    const endpointDateOptions = [7,13,33];
    const clusterTypeOptions = ['bgmm','gmm','kmeans','ward','spectral',];
    const lrtConfounderOptions = [
        't4','n3',
        'BOT','Tonsil',
        't3','n2',
        't_severe','n_severe',
        'hpv',
        'total_mean_dose',
        'Parotid_Gland_limit',
        'IPC_limit','MPC_limit','SPC_limit',
        'Larynx_limit',
        'age','age_65',
        'IMRT','VMAT','IMPRT',
        'performance_1','performance_2','performance_high',
    ]

    const [featureButtons,setFeatureButtons] = useState(<></>);
    const [confounderButtons, setConfounderButtons] = useState(<></>)
    // const [symptomsButtons,setSymptomButtons] = useState(<></>);
    const [mainSymptomButtonOptions,setMainSymptomButtonOptions] = useState(<></>);
    const [nClustButtonOptions, setNClustButtonOptions] = useState(<Dropdown.Item value={0}>{0}</Dropdown.Item>);
    // const [tempClusterFeatures,setTempClusterFeatures] = useState();
    const [tempNClusters, setTempNClusters] = useState(1);
    const [tempConfounders,setTempConfounders] = useState();
    const [tempClusterType,setTempClusterType] = useState();
    const [tempEndpointDates, setTempEndpointDates] = useState()
    const [tempSOIs,setTempSOIs] = useState();
    const [plotVarButton, setPlotVarButton] = useState(<></>);
    const removeKey = 'None'


    // useEffect(()=>{
    //     let features = [];
    //     for(let f of props.clusterFeatures){ features.push(f);}
    //     props.setTempClusterFeatures(features);
    // },[props.clusterFeatures])


    useEffect(()=>{
        let confs = [];
        for(let f of props.lrtConfounders){ confs.push(f);}
        setTempConfounders(confs);
    },[props.lrtConfounders])

    useEffect(()=>{
        if(props.nDoseClusters !== tempNClusters){
            setTempNClusters(parseInt(props.nDoseClusters))
        }
    },[props.nDoseClusters])

    useEffect(() => {
        if(props.symptomsOfInterest !== tempSOIs){
            setTempSOIs(props.symptomsOfInterest);
        }
    },[props.symptomsOfInterest])

    useEffect(()=>{
        if(props.endpointDates !== tempEndpointDates){
            setTempEndpointDates(props.endpointDates)
        }
    },[props.endpointDates])

    
    function handleChangeNClusters(d,e){
        let val = parseInt(d);
        if(tempNClusters !== val){
            setTempNClusters(val);
        }
    }

    function handleChangePlotVar(d,e){
        if(props.plotVar !== d){
            props.setPlotVar(d);
        }
    }

    function handleUpdateClusters(){
        //this may be buggy if react changes the api to make it not batch update
        //since it would trigger a cluster api call half way through,
        //in case this is a future issue.
        //also tis doesnt work if one of these becomes asynce for some reason
        props.setClusterDataLoading(true);
        if(props.tempClusterFeatures !== undefined & props.tempClusterFeatures.length > 0){
            let tempF = props.tempClusterFeatures.slice();
            props.setClusterFeatures(tempF)
        }
        if(tempNClusters !== undefined & tempNClusters > 1){
            let tempN = parseInt(tempNClusters);
            props.setNDoseClusters(tempN)
        }
        if(tempClusterType !== undefined & tempClusterType !== props.clusterType){
            let tempType = tempClusterType + '';
            props.setClusterType(tempType);
        }
        props.updateClusterOrgans();
    }

    function handleUpdateOutcomes(){
        if(tempConfounders !== undefined & tempConfounders !== props.lrtConfounder){
            let tempConf = tempConfounders.slice();
            props.setLrtConfounders(tempConf);
        }
        if(tempEndpointDates !== undefined & tempEndpointDates.length > 0){
            let tempEndpoints = tempEndpointDates.slice();
            tempEndpoints.sort();
            props.setEndpointDates(tempEndpoints);
        }
    }

    function updateEndpoints(){
        if(tempEndpointDates !== undefined & tempEndpointDates.length > 0){
            let tempEndpoints = tempEndpointDates.slice();
            tempEndpoints.sort();
            props.setEndpointDates(tempEndpoints);
        }
    }

    function makeDropdownListUpdater(tempVals,setTempVals){
        var handleChangeFeature = (d,e) => {
            if(tempVals.indexOf(d) >= 0){return;}
            let parentValue = e.target.parentElement.parentElement.getAttribute('value');
            let newValList = [];
            for(let f of tempVals){
                if(f !== parentValue){ newValList.push(f); }
            }
            if(d !== removeKey){ newValList.push(d); }
            setTempVals(newValList)
        }
        return handleChangeFeature
    }

    function makeDropDownList(featureList,options,setTempFeatures){
        if(featureList === undefined){ return (<></>)}
        var features = featureList.slice();
        features.sort();
        features.push('+')
        let optionValues = [removeKey];
        for(let x of options){ optionValues.push(x); }
        const onclick =makeDropdownListUpdater(featureList,setTempFeatures);
        let newOptions = optionValues.filter(x=> features.indexOf(x) < 0)
            .map((d,i)=>{
                return (
                    <Dropdown.Item
                        key={i}
                        value={d}
                        eventKey={d}
                        onClick={(e)=>onclick(d,e)}
                    >{d}</Dropdown.Item>
                )
            })
        let fButtons = features.map((f,i)=>{
            return (
                <DropdownButton
                    // className={'controlDropdownButton compactButton'}
                    title={f}
                    value={f}
                    key={f+i}
                    ifx={i}
                    variant={'primary'}
                >
                    {newOptions}
                </DropdownButton>
            )
        })
        return fButtons
    }

    useEffect(function showClusterFeatures(){
        if(props.tempClusterFeatures === undefined){ return; }
        let fb = makeDropDownList(props.tempClusterFeatures,plotVarOptions,props.setTempClusterFeatures)//,handleChangeClusterFeatures)
        setFeatureButtons(fb)
    },[props.tempClusterFeatures]);

    useEffect(function showConfounders(){
        if(tempConfounders === undefined){ return; }
        let cb = makeDropDownList(tempConfounders,lrtConfounderOptions,setTempConfounders)//handleChangeLrtConfounders);
        setConfounderButtons(cb);
    },[tempConfounders]);

    // useEffect(function showSymptoms(){
    //     if(tempSOIs === undefined){ return; }
    //     let sb = makeDropDownList(tempSOIs,props.allSymptoms,setTempSOIs)//handleChangeSOIs);
    //     setSymptomButtons(sb);
    // },[tempSOIs,props.allSymptoms])

    useEffect(function showNClusterDropDown(){
        let nclustOptions = nClusterOptions.map((d,i)=>{
            return (
                <Dropdown.Item
                    key={i}
                    value={d}
                    eventKey={d}
                    onClick={()=>handleChangeNClusters(d)}
                >{d}</Dropdown.Item>
            )
        })
        setNClustButtonOptions(nclustOptions)
    },[tempNClusters])

    useEffect(()=>{
        if(props.symptomsOfInterest == undefined){ return; }
        let sOpts = props.symptomsOfInterest.map((s,i) => {
            return (<Dropdown.Item
                    key={i}
                    value={s}
                    eventKey={s}
                    onClick={ 
                        (e)=>{
                            if(s!==props.mainSymptom){ props.setMainSymptom(s); } 
                        } 
                    }
                >{s}</Dropdown.Item>)
        });
        setMainSymptomButtonOptions(sOpts);
    },[props.mainSymptom,props.symptomsOfInterest])

    useEffect(function plotVarDropDown(){
        let pVarOptions = plotVarOptions.map((d,i)=>{
            return (
                <Dropdown.Item
                    key={i}
                    value={d}
                    eventKey={d}
                    onClick={(e)=>handleChangePlotVar(d,e)}
                >{d}</Dropdown.Item>
            )
        })
        setPlotVarButton(
            <DropdownButton
                // className={'controlDropdownButton'}
                value={props.plotVar}
                title={''+props.plotVar}
            >{pVarOptions}</DropdownButton>
        )
    },[props.plotVar])

    const clusterTypeButtonOptions = clusterTypeOptions.map((d,i)=>{
        return(
            <Dropdown.Item
                key={i}
                value={d}
                eventKey={d}
                onClick={(e)=>setTempClusterType(d)}
            >{d}</Dropdown.Item>
        )
    });

    function makeToggleLabelsButton(){
        return (
            <>
            <Button
                value={props.showOrganLabels}
                variant={props.showOrganLabels? 'dark': 'outline-secondary'}
                onClick={() => props.setShowOrganLabels(true)}
                disabled={props.showOrganLabels}
            >{'Show'}</Button>
            <Button
                value={!props.showOrganLabels}
                variant={props.showOrganLabels? 'outline-secondary': 'dark'}
                onClick={() => props.setShowOrganLabels(false)}
                disabled={!props.showOrganLabels}
            >{'Hide'}</Button>
            <Button
                variant={'light'}
            >{"Labels"}</Button>
            </>
        )
    }

    function addEndpoint(date){
        if(tempEndpointDates.indexOf(date) < 0){
            let newDates = tempEndpointDates.map(d=>parseInt(d));
            newDates.push(parseInt(date))
            newDates.sort();
            setTempEndpointDates(newDates);
        } else{
            let index = tempEndpointDates.indexOf(date);
            let newDates = tempEndpointDates.slice();
            newDates.splice(index,1);
            newDates.sort();
            setTempEndpointDates(newDates);
        }
    }

    function makeEndpointToggle(date){
        if(tempEndpointDates === undefined){
            return (
                <Button>
                    {'Temp'}
                </Button>
            )
        }
        let active = tempEndpointDates.indexOf(date) >= 0;
        return (
            <Button
                value={date}
                variant={active? 'dark':'outline-secondary'}
                disabled={active & (tempEndpointDates.length <= 1)}
                onClick={()=>addEndpoint(date)}
            >{date}</Button>
        )
    }
    
    function makeEndpointButtons(){
        let buttons = endpointDateOptions.map(d=>makeEndpointToggle(d));
        return (
            <span>
                {buttons}
            </span>
        )
    }

    const clusterButtonTitle = (tempClusterType === undefined)? props.clusterType: tempClusterType;
    // const onToggleShowContra = () => {
    //     props.setShowContralateral(!props.showContralateral);
    // }
    const disabled = props.clusterDataLoading;
    return (
        <Row className={'clusterControlPanel noGutter'} fluid={'false'} md={12}>
            {/* <Col  md={10}> */}
                <Row  md={12} className={'noGutter'}>
                    <Col className={'borderRight'} md={6} >
                        <Row md={12} className={'noGutter'}>
                            <span className={'viewTitle'}>
                                {'Cluster Parameters'}
                            </span>   
                        </Row>
                    
                        <Row md={12} className={'noGutter'}>
                            <Col md={4} className={'noGutter'}>
                                {'# Clust:'}
                                <DropdownButton
                                    className={'controlDropdownButton'}
                                    value={(tempNClusters!==undefined)? tempNClusters+'':props.nDoseClusters+""}
                                    title={(tempNClusters!==undefined)? tempNClusters+'':props.nDoseClusters+""}
                                >
                                    {nClustButtonOptions}
                                </DropdownButton>
                            </Col>
                            <Col md={4}  className={'noGutter'}>
                                {'Method:'}
                                <DropdownButton
                                    className={'controlDropdownButton'}
                                    value={clusterButtonTitle}
                                    title={clusterButtonTitle}
                                >
                                    {clusterTypeButtonOptions}
                                </DropdownButton>
                            </Col>
                            <Col md={4} className={'noGutter'}>
                                {makeToggleLabelsButton()}
                            </Col>
                        </Row>
                        <Row md={12} className={'noGutter'} >
                            <Col md={12}>
                            {'Clust Features: '}
                            {featureButtons}
                            </Col>
                        </Row>
                        <Row style={{'margin':'0px','marginTop': '1em'}} className={'controlPanelTitle'} md={12}>
                            <Button
                                onClick={handleUpdateClusters}
                                disabled={disabled}
                                variant={!disabled? "outline-primary":'dark'}
                            >
                                {'Run Clustering'}
                            </Button>
                        </Row>
                    </Col>
                    <Col className={'borderRight'} md={6}>
                        <Row md={12} className={'noGutter'}>
                            <span className={'viewTitle'}>
                                {'Outcome Parameters'}
                            </span>   
                        </Row>
                        <Row md={12} className={'noGutter'}>
                            <Col md={6} className={'noGutter'}>
                                {'Symptom:'}
                                <DropdownButton
                                    className={'controlDropdownButton'}
                                    value = {props.mainSymptom}
                                    title = {props.mainSymptom}
                                >{mainSymptomButtonOptions}</DropdownButton>
                            </Col>
                            <Col md={6} className={'noGutter'}>
                                <span>{'Endpoints (wks): '}</span>
                                {makeEndpointButtons()}
                                <span>{'  '}</span>
                                <span>
                                    <Button
                                        variant={'outline-primary'}
                                        onClick={updateEndpoints}
                                    >
                                        {' Set '}
                                    </Button>
                                </span>
                            </Col>
                            <Col md={12} className={'noGutter'}>
                                {'Confounders: '}
                                {confounderButtons}
                            </Col>
                        </Row>
                        <Row style={{'margin':'0px','marginTop': '1em'}} className={'controlPanelTitle'} md={12}>
                            <Button
                                onClick={handleUpdateOutcomes}
                                // disabled={disabled}
                                variant={"outline-primary"}
                            >
                                {'Update Outcomes'}
                            </Button>
                        </Row>
                    </Col>
                </Row>
                
            {/* </Col> */}
            {/* <Col sm={2}>
                <Row md={12}>
                    <span className={'viewTitle'}>
                        {"Plot Parameters"}
                    </span>
                </Row>
                <Row md={12}>
                    <Col>
                        <span>
                            {'Dose Color:'}
                            {plotVarButton}
                        </span>   
                    </Col>
                    <Col>
                        {makeToggleLabelsButton()}
                    </Col>
                
                </Row>
            </Col> */}
            
        </Row>
    )
}