import React, {useState, useEffect, useRef, useMemo} from 'react';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";
import AttributionPlotD3 from './AttributionPlotD3.js';
import ScatterPlotD3 from './ScatterPlotD3.js';
import {NeighborVisD3,NeighborVisLabels} from './NeighborVisD3';
import LNVisD3 from './LNVisD3';
import DLTVisD3 from './DLTVisD3';
import SubsiteVisD3 from './SubsiteVisD3.js';
import AttributionLegend from './AttributionLegend.js';
import {Spinner} from '@chakra-ui/react'

export default function AuxillaryViews(props){

    const container = useRef();

    const auxViewOptions = ['attributions','scatterplot','neighbors']
    const [auxView,setAuxView] = useState('attributions');

    function wrapTitle(item,text){
        return (
            <div className={'fillSpace'}>
            <div style={{'height':'1.5em'}} className={'title'}>
                {text}
            </div>
            <div style={{'height':'calc(100% - 1.5em)','width':'100%'}}>
            {item}
            </div>
            </div>
        )
    }

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
      let values = {
          'similarity': p['similarity'],
          'decision': p['decision'],
      }
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

    function makeNeighborView(currEmbeddings,currState,cohortData,simulation,fixedDecisions,modelOutput,brushedId){
        if(Utils.allValid([currEmbeddings,cohortData,simulation])){
        const getSimulation = props.getSimulation;
        const neighborsToShow=props.neighborsToShow;
        const dltSvgPaths=props.dltSvgPaths;
        const subsiteSvgPaths=props.subsiteSvgPaths;
        const lnSvgPaths=props.lnSvgPaths;
          let decision = fixedDecisions[currState];
          if(decision < 0){
            let sim = getSimulation();
            decision = (sim['decision'+(currState+1)] > .5)? 1: 0;
          }
          const dString = constants.DECISIONS[currState];
          const getNeighbor = id => encodePatient(Object.assign({},cohortData[id+'']));
          var neighbors = [];
          var cfs = [];
          for(let i in currEmbeddings.neighbors){
            var id = currEmbeddings.neighbors[i];
            var sim = currEmbeddings.similarities[i];
            var nData = getNeighbor(id);
            nData.id = id;
            nData.similarity = sim;
            nData.decision = nData[dString];
            var isCf = nData[dString] !== decision;
            nData.isCf = isCf;
            const maxCfs = cfs.length >= neighborsToShow;
            const maxN = neighbors.length >= neighborsToShow;
            if(!maxCfs & isCf){
              cfs.push(nData);
            } else if(!maxN & !isCf){
              neighbors.push(nData);
            }
            if((cfs.length >= neighborsToShow) & (neighbors.length >= neighborsToShow)){
              break
            }
          }
    
          function getPatientMeans(plist){
            const meanObj = {};
            for(let obj of plist){
              for(let [key,value] of Object.entries(obj)){
                let currVal = meanObj[key] === undefined? 0: meanObj[key];
                currVal += value/plist.length;
                meanObj[key] = currVal
              }
            }
            meanObj.id = -2 - meanObj.decision;
            return meanObj;
          }
          const meanTreated = decision > .5? getPatientMeans(neighbors): getPatientMeans(cfs);
          const meanUntreated = decision > .5? getPatientMeans(cfs): getPatientMeans(neighbors);
          const cScale = Utils.getColorScale('attributions');
          var p = cfs.concat(neighbors);
          p.sort((a,b)=> b.similarity - a.similarity);
          const toScale = constants.continuousVars;
          var ranges = {};
          for(let key of toScale){
            let extent = d3.extent(Object.values(cohortData).map(d=>d[key]));
            ranges[key] = extent;
          }
          const width = container.current.clientWidth;
          const nPerRow = width > 1000? 2:1;
          const thingHeight = width/(nPerRow*5.6);
          const dltWidth = thingHeight/2;
          const lnWidth = thingHeight;
          const subsiteWidth = thingHeight;
          const nWidth = thingHeight;
          const encodedRef = encodePatient(props.patientFeatures);
        //   const nWidth = 'calc(100% - ' + dltWidth + ' - ' + lnWidth + ' - ' + subsiteWidth + ')'
          function makeN(d,i,useReference=true,showLabels=false,bottomBorder=false,brushable=true){
            const borderColor = d[dString] > .5? constants.yesColor: constants.noColor;
            const bBorder = bottomBorder? '.4em solid black':'';
            const marginBottom = bottomBorder? '.4em': '.01em';
            function brush(){
              let pId = parseInt(d.id)
              if(pId > 0 & pId !== brushedId){
                props.setBrushedId(pId);
              } else{
                props.setBrushedId(undefined);
              }
            }
            return (
            <div key={d.id+'-'+i} 
               style={{'margin':'.2em','height': thingHeight,
               'width': 'auto',
               'diplay': 'inline-flex',
               'justifyContent':'flex-start',
               'borderStyle':'solid',
              'borderColor': borderColor,'borderWidth':'.2em',
              'marginBottom': marginBottom,
              'borderBottom': bBorder,
              }}
              onClick={()=>brush()}
              >
              <div style={{'margin':0,'width': dltWidth,'height':'100%','display':'inline-block','verticalAlign':'top'}}>
                <div  className={'title'} style={{'width':'100%','height':'1em'}}>{"DLTs"}</div>
                <div style={{'width':'100%','height':'calc(100% - 1em)'}}>
                  <DLTVisD3
                    dltSvgPaths={dltSvgPaths}
                    data={d}
                    currState={currState}
                    isMainPatient={false}
                  />
                </div>
                
              </div>
              <div style={{'margin':0,'width': lnWidth,'height':'100%','display':'inline-block','verticalAlign':'top'}}>
                <div  className={'title'} style={{'width':'100%','height':'1em'}}>{"LN"}</div>
                <div style={{'width':'100%','height':'calc(100% - 1em - 10px)','marginTop':'10px'}}>
                  <LNVisD3
                    lnSvgPaths={lnSvgPaths}
                    data={d}
                    isMainPatient={false}
                  ></LNVisD3>
                </div>
              </div>
              <div style={{'margin':0,'width': subsiteWidth,'height':'100%','display':'inline-block','verticalAlign':'top'}}>
                <div  className={'title'} style={{'width':'100%','height':'1em'}}>{"Subsite"}</div>
                <div style={{'width':'100%','height':'calc(100% - 1em - 10px)','marginTop':'10px'}}>
                  <SubsiteVisD3
                    subsiteSvgPaths={props.subsiteSvgPaths}
                    data={d}
                    isSelectable={false}
                    featureQue={{}}
                  ></SubsiteVisD3>
                </div>
              </div>
              <div style={{'margin':0,'width': nWidth,'height':'100%','display':'inline-block','verticalAlign':'top'}}>
                <div  className={'title'} style={{'width':'100%','height':'1em'}}>{"Staging"}</div>
                <div style={{'width':'100%','height':'calc(100% - 1em - 10px)','marginTop':'10px'}}>
                <NeighborVisD3
                  data={d}
                  referenceData={encodedRef}
                  key={d.id+i}
                  lnSvgPaths={lnSvgPaths}
                  valRanges={ranges}
                  dltSvgPaths={dltSvgPaths}
                  currState={currState}
                  showLabels={showLabels}
                  version={'staging'}
                ></NeighborVisD3>
                </div>
              </div>
              <div style={{'margin':0,'width': nWidth,'height':'100%','display':'inline-block','verticalAlign':'top'}}>
                <div  className={'title'} style={{'width':'100%','height':'1em'}}>{"Baseline"}</div>
                <div style={{'width':'100%','height':'calc(100% - 1em - 10px)','marginTop':'10px'}}>
                <NeighborVisD3
                  data={d}
                  referenceData={encodedRef}
                  key={d.id+i}
                  lnSvgPaths={lnSvgPaths}
                  valRanges={ranges}
                  dltSvgPaths={dltSvgPaths}
                  currState={currState}
                  showLabels={showLabels}
                  version={'useful'}
                ></NeighborVisD3>
                </div>
              </div>
              <div style={{'margin':0,'width': nWidth,'height':'100%','display':'inline-block','verticalAlign':'top'}}>
                <div  className={'title'} style={{'width':'100%','height':'1em'}}>{"Outcomes"}</div>
                <div style={{'width':'100%','height':'calc(100% - 1em - 10px)','marginTop':'10px'}}>
                <NeighborVisD3
                  data={d}
                  referenceData={undefined}
                  key={d.id+i+'outcomes'}
                  lnSvgPaths={lnSvgPaths}
                  valRanges={ranges}
                  dltSvgPaths={dltSvgPaths}
                  currState={currState}
                  showLabels={showLabels}
                  version={'outcomes'}
                ></NeighborVisD3>
                </div>
              </div>
            </div>
            )
          }
          const nStuff = p.map((d,i) => makeN(d,i,true,false));
    
          if(nPerRow < 2){
            return (
              <div className={'centerText scroll'} style={{'width':'100%!important','height':'100%',
                      'display':'inline-flex','flexFlow':'row wrap','flexDirection':'row','alignItems':'flex-start'}}>
                  {makeN(meanTreated,'n',false,false,false)}
                  {makeN(meanUntreated,'cf',false,false,false)}
                  <hr style={{'width':'100%','display':'block','marginTop':'10px'}}></hr>
                  {nStuff}
              </div>
              );
          } else{
            return (<div className={'fillSpace'}>
              <div className={'scroll'} style={{'width':'49%','height':'100%',
                      'display':'inline-flex','flexFlow':'row wrap','flexDirection':'row','alignItems':'flex-start'}}>
                  {makeN(meanUntreated,'cf',false,false,false)}
                  <hr style={{'width':'100%','display':'block','marginTop':'10px'}}></hr>
                  {nStuff}
              </div>
              <div className={'scroll'} style={{'width':'49%','height':'100%',
                      'display':'inline-flex','flexFlow':'row wrap','flexDirection':'row','alignItems':'flex-start'}}>
                  {makeN(meanUntreated,'cf',false,false,false)}
                  <hr style={{'width':'100%','display':'block','marginTop':'10px'}}></hr>
                  {nStuff}
              </div>
            </div>)
          }
          
        } 
        else{
          return <Spinner>{'No'}</Spinner>
        }
    }


    function makeAttributionPlot(props){
        const attr = (
            <div  className={'fillSpace'} >
                <div style={{'height':'calc(100% - 6em)','width': '100%'}}>
                <AttributionPlotD3
                    simulation={props.simulation}
                    currState={props.currState}
                    defaultPredictions={props.defaultPredictions}
                    modelOutput={props.modelOutput}
                    fixedDecisions={props.fixedDecisions}
                />
                </div>
                <div style={{'height':'6em','width': '100%'}}>
                    <AttributionLegend
                      simulation={props.simulation}
                      currState={props.currState}
                      modelOutput={props.modelOutput}
                      fixedDecisions={props.fixedDecisions}
                    />
                </div>
            </div>
            
        )
        return attr
    }
      

    function makeScatterplot(props){
        return (
            <div key={'no'} className={'fillSpace'} >
                <div style={{'height':'calc(100% - 6em)','width': '100%'}}>
                <ScatterPlotD3
                    cohortData={props.cohortData}
                    cohortEmbeddings={props.cohortEmbeddings}
                    currState={props.currState}
                    setCurrState={props.setCurrState}
                    patientFeatures={props.patientFeatures}
                    currEmbeddings={props.currEmbeddings}
                    modelOutput={props.modelOutput}
                    simulation={props.simulation}
        
                    patientEmbeddingLoading={props.patientEmbeddingLoading}
                    patientSimLoading={props.patientSimLoading}
                    cohortLoading={props.cohortLoading}
                    cohortEmbeddingsLoading={props.cohortEmbeddingsLoading}
        
                    updatePatient={props.updatePatient}
        
                    brushedId={props.brushedId}
                    setBrushedId={props.setBrushedId}
                />
                </div>
                <div style={{'height':'6em','width': '100%'}}>
                    {'legend'}
                </div>
            </div>
            
        );
      }

      function outcomeToggle(){
        return Utils.makeStateToggles(auxViewOptions,auxView,setAuxView);
      }
      
      const currView = useMemo(()=>{
        switch(auxView){
            case 'neighbors':
                return makeNeighborView(props.currEmbeddings,props.currState,props.cohortData,props.simulation,props.fixedDecisions,props.modelOutput,props.brushedId);
                break;
            case 'scatterplot':
                return makeScatterplot(props);
                break;
            default:
                return makeAttributionPlot(props);
        }
    },[props,auxView])

    return (
            <div className={'fillSpace'} ref={container}>
            <div style={{'height':'2.5em','width':'100%'}}>
                {outcomeToggle()}
            </div>
            <div style={{'height':'calc(100% - 2.15em)','width':'100%'}}>
                {currView}
            </div>
            </div>
    );
}