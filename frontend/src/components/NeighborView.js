import React, {useRef,useMemo} from 'react';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";

import {NeighborVisD3} from './NeighborVisD3';
import LNVisD3 from './LNVisD3';
import DLTVisD3 from './DLTVisD3';
import SubsiteVisD3 from './SubsiteVisD3.js';
import {Spinner} from '@chakra-ui/react';

function encodeOrdinal(p,key,values,scale=false){
    let val = values[0];
    let isMissing=true;
    for(let i of values){
        if(p[key+'_'+i] > 0){
            val = i;
            isMissing = false;
            break;
        }
    }
    return val
}

  function encodePatient(p){
    if(p === undefined){
        return undefined;
    }
    let values = Object.assign({},p)
    // let values = {
    //     'similarity': p['similarity'],
    //     'decision': p['decision'],
    // }
    for(const [key,v] of Object.entries(constants.ordinalVars)){
        values[key] = encodeOrdinal(p,key,v);
    }
    for(let key of constants.continuousVars){
        let val = p[key] === undefined? 0:p[key];
        values[key] = val;
    }
    for(let key of constants.booleanVars){
        let val = p[key] === undefined? 0:p[key];
        values[key] = val;
    }
    for(let key of constants.DECISIONS){
        let val = p[key] === undefined? 0:p[key];
        values[key] = val;
    }
    for(let key of constants.OUTCOMES){
        let val = p[key] === undefined? 0:p[key];
        values[key] = val;
    }
    return values;
}

export default function NeighborView(props){
    const view = useMemo(()=>{
        if(!props.patientSimLoading & Utils.allValid([props.container, props.currEmbeddings,props.cohortData,props.simulation,props.cohortEmbeddings])){
        const getSimulation = props.getSimulation;
        const dltSvgPaths=props.dltSvgPaths;
        const subsiteSvgPaths=props.subsiteSvgPaths;
        const lnSvgPaths=props.lnSvgPaths;
        const currState = props.currState;
        const cohortData = props.cohortData;
        const fixedDecisions = props.fixedDecisions;
        const brushedId = props.brushedId;
        let decision = Utils.getDecision(fixedDecisions,currState,getSimulation);

        const dString = constants.DECISIONS[currState];
        const [sim,altSim] = props.getSimulation(true);

        if(sim === undefined){
            return (<Spinner/>)
        }
        const [neighborsUF,cfsUF,caliperVal] = Utils.getTreatmentGroups(sim,props.currEmbeddings,props.cohortData,props.currState,props.cohortEmbeddings);
        const neighbors = neighborsUF.map(encodePatient);
        const cfs = cfsUF.map(encodePatient);

        const dname = constants.DECISIONS_SHORT[props.currState];
        const dnameLong = constants.DECISIONS[props.currState];
        function getPatientMeans(plist){
            const meanObj = {};
            for(let obj of plist){
            for(let [key,value] of Object.entries(obj)){
                //skip unknown hpv
                if(key === 'hpv' & value < 0){continue}
                let currVal = meanObj[key] === undefined? 0: meanObj[key]+0;
                currVal += value/plist.length;
                meanObj[key] = currVal+0;
            }
            }
            meanObj.id = -2 - (meanObj[dnameLong] > .5? 1: 0);
            return meanObj;
        }

        const meanTreated = decision > .5? getPatientMeans(neighbors): getPatientMeans(cfs);
        const meanUntreated = decision > .5? getPatientMeans(cfs): getPatientMeans(neighbors);

        var p = cfs.concat(neighbors);
        p.sort((a,b)=> b.similarity - a.similarity);
        const toScale = constants.continuousVars;
        var ranges = {};
        for(let key of toScale){
            let extent = d3.extent(Object.values(cohortData).map(d=>d[key]));
            ranges[key] = extent;
        }

        const width = props.container.current? props.container.current.clientWidth: 0;
        const nPerRow = width > 1000? 2:1;
        const thingHeight = width/(nPerRow*5.3);
        const dltWidth = thingHeight/2;
        const lnWidth = thingHeight*.8;
        const subsiteWidth = thingHeight*.7;
        const nWidth = thingHeight;
        const titleWidth = thingHeight/2;
        const encodedRef = encodePatient(props.patientFeatures);
        const fixWidth = v => props.currState == 0? v: v- (dltWidth/6);
        //   const nWidth = 'calc(100% - ' + dltWidth + ' - ' + lnWidth + ' - ' + subsiteWidth + ')'

        function makeN(d,i,showTicks,bottomBorder=true,name=undefined){
            const borderColor = d[dString] > .5? constants.knnColor: constants.knnColorNo;
            const bBorder = bottomBorder? '.4em solid ' + borderColor:'';
            const marginBottom = bottomBorder? '.4em': '.01em';
            const showLabels = true;
        
            function brush(){
            let pId = parseInt(d.id)
            if(pId > 0 & pId !== brushedId){
                props.setBrushedId(pId);
            } else{
                props.setBrushedId(undefined);
            }
            }
            
            if(name === undefined){
                if(i === 'n' | i === 'cf'){
                    if(d[dString] > .5){
                    name = dname + ' avg.'
                    } else{
                    name = 'no ' + dname + ' avg.'
                    }
                } else{
                    // name = d.id + ': ';
                    name = ''
                    if(d[dString] > .5){
                    name += dname;
                    } else{
                    name += 'no ' + dname;
                    }
                }
            }
            const noTicks = !showTicks || width < 500;
            const headerSize = noTicks? '0px': '1.1em';
            const viewSize = 'calc(100% - ' + headerSize + ' - 10px)';
            const headerStyle = {'width':'100%','height':headerSize,'fontSize': width > 600? '':'2vw'};
            const viewStyle   = {'width':'100%','height':viewSize,'marginTop':'15px'}
            const componentStyle = w => {return {'margin':0,'width': fixWidth(w),'height':'100%','display':'inline-block','verticalAlign':'top'}}
            function makeHeader(text){
                if(width > 500 || showTicks){
                    return (<div  className={'title'} style={headerStyle}>{text}</div>)
                } 
                return <></>
            }
            return (
            <div key={d.id+' '+props.currState+ ' ' +i} 
            style={{'margin':'.2em','height': thingHeight,
            'width': 'auto',
            'diplay': 'inline-flex',
            'justifyContent':'flex-start',
            'marginBottom': marginBottom,
            'borderBottom': bBorder,
            }}
            onClick={()=>brush()}
            >
            <div className={'toggleButtonLabel'} style={{'display':'inline-flex','width': fixWidth(titleWidth),'fontSize':14,'height':'100%','justifyContent':'center','alignItems':'center'}}>
                {name}
            </div>
            {props.currState > 0? (<div style={componentStyle(dltWidth)}>
                {makeHeader('DLTs')}
                <div style={viewStyle}>
                <DLTVisD3
                    dltSvgPaths={dltSvgPaths}
                    data={d}
                    currState={currState}
                    isMainPatient={false}
                />
                </div>
                
            </div>) : <></>}
            <div style={componentStyle(lnWidth)}>
                {makeHeader('LNs')}
                <div style={viewStyle}>
                <LNVisD3
                    lnSvgPaths={lnSvgPaths}
                    data={d}
                    isMainPatient={false}
                    useAttention={false}
                ></LNVisD3>
                </div>
            </div>
            <div style={componentStyle(subsiteWidth)}>
                {makeHeader('Subsite')}
                <div style={viewStyle}>
                <SubsiteVisD3
                    subsiteSvgPaths={props.subsiteSvgPaths}
                    data={d}
                    isSelectable={false}
                    featureQue={{}}
                ></SubsiteVisD3>
                </div>
            </div>
            <div style={componentStyle(nWidth)}>
                {makeHeader('Staging')}
                <div style={viewStyle}>
                    <NeighborVisD3
                    data={d}
                    referenceData={encodedRef}
                    // key={d.id+i}
                    lnSvgPaths={lnSvgPaths}
                    valRanges={ranges}
                    dltSvgPaths={dltSvgPaths}
                    currState={currState}
                    version={'staging'}
                    name={name}
                    showTicks={!noTicks}
                    ></NeighborVisD3>
                </div>
            </div>
            <div style={componentStyle(nWidth)}>
                {makeHeader('Baseline')}
                <div style={viewStyle}>
                <NeighborVisD3
                data={d}
                referenceData={encodedRef}
                // key={d.id+i}
                lnSvgPaths={lnSvgPaths}
                valRanges={ranges}
                dltSvgPaths={dltSvgPaths}
                currState={currState}
                version={'useful'}
                name={name}
                showTicks={!noTicks}
                ></NeighborVisD3>
                </div>
            </div>
            <div style={componentStyle(nWidth)}>
                {makeHeader('Outcomes')}
                <div style={viewStyle}>
                <NeighborVisD3
                data={d}
                referenceData={undefined}
                // key={d.id+i+'outcomes'}
                lnSvgPaths={lnSvgPaths}
                valRanges={ranges}
                dltSvgPaths={dltSvgPaths}
                currState={currState}
                version={'outcomes'}
                name={name}
                showTicks={!noTicks}
                ></NeighborVisD3>
                </div>
            </div>
            </div>
            )
        }
        const nStuff = p.map((d,i) => makeN(d,i,false));

            return (
            <div className={'centerText scroll'} 
            key={props.currState+'neighbors'}
            style={{'width':'100%!important','height':'100%','marginTop':'1em',
                    'display':'inline-flex','flexFlow':'row wrap','flexDirection':'row','alignItems':'flex-start'}}>
                {makeN(meanTreated,'n',true)}
                {makeN(meanUntreated,'cf',true)}
                <hr style={{'width':'100%','display':'block','marginTop':'10px'}}></hr>
                {nStuff}
            </div>
            );
        } 
        else{
        return <Spinner/>
        }
    },[props]);

    return view

}