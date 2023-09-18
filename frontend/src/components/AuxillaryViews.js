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
import {Spinner} from '@chakra-ui/react'

export default function AuxillaryViews(props){

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
          const getNeighbor = id => Object.assign({},cohortData[id+'']);
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
          const thingHeight = '8em';
          const dltWidth = '4em'
          const lnWidth = '5em';
          const subsiteWidth = '4em';
          const nWidth = 'calc(100% - ' + dltWidth + ' - ' + lnWidth + ' - ' + subsiteWidth + ')'
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
            <div key={d.id} 
               style={{'margin':'.2em','height': thingHeight,
               'width': '100%','diplay': 'block','borderStyle':'solid',
              'borderColor': borderColor,'borderWidth':'.2em',
              'marginBottom': marginBottom,
              'borderBottom': bBorder,
              }}
              onClick={()=>brush()}
              >
              <div style={{'width': dltWidth,'height':'100%','display':'inline-block'}}>
              <DLTVisD3
                dltSvgPaths={dltSvgPaths}
                data={d}
                currState={currState}
                isMainPatient={false}
              />
              </div >
              <div style={{'width': lnWidth,'height':'100%','display':'inline-block'}}>
                <LNVisD3
                  lnSvgPaths={lnSvgPaths}
                  data={d}
                  isMainPatient={false}
                ></LNVisD3>
              </div>
              <div style={{'width':subsiteWidth,'height':'100%','display':'inline-block'}}>
                <SubsiteVisD3
                  subsiteSvgPaths={props.subsiteSvgPaths}
                  data={d}
                  isSelectable={false}
                  featureQue={{}}
                ></SubsiteVisD3>
              </div>
              <div style={{'width':nWidth,'height':'100%','display':'inline-block'}}>
                <NeighborVisD3
                  data={d}
                  referenceData={undefined}
                  referenceQue={undefined}
                  key={d.id+i}
                  lnSvgPaths={lnSvgPaths}
                  valRanges={ranges}
                  dltSvgPaths={dltSvgPaths}
                  currState={currState}
                  showLabels={showLabels}
                ></NeighborVisD3>
              </div>
            </div>
            )
          }
          const nStuff = p.map((d,i) => makeN(d,i,true,false));
    
          return (
            <div className={'fillSpace centerText scroll'}>
                {makeN(meanTreated,'n',false,false,false)}
                {makeN(meanUntreated,'cf',false,false,false)}
                <hr></hr>
                {nStuff}
            </div>);
        } else{
          return <Spinner>{'No'}</Spinner>
        }
    }


    function makeAttributionPlot(props){
        const attr = (
            <div className={'fillSpace'} >
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
                    {'legend'}
                </div>
            </div>
            
        )
        return attr
    }
      

    function makeScatterplot(props){
        return (
            <div className={'fillSpace'} >
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
            <div className={'fillSpace'}>
            <div style={{'height':'2.5em','width':'100%'}}>
                {outcomeToggle()}
            </div>
            <div style={{'height':'calc(100% - 2.15em)','width':'100%'}}>
                {currView}
            </div>
            </div>
    );
}