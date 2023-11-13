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
import SurvivalPlots from './SurvivalPlots.js';
import {Spinner} from '@chakra-ui/react';

import * as HelpTexts from '../modules/Text';
import HelpText from '../modules/HelpText';

export default function AuxillaryViews(props){

    const container = useRef();

    const auxViewOptions = ['survival','attributions','neighbors','scatterplot'];
    const auxViewLabels =['Survival','Feature Importance','Similar Patients','Scatterplot']
    const [auxView,setAuxView] = useState('attributions');


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

  function getNeighbors(decision,currEmbeddings,currState,cohortData,nToShow){
    
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
      const maxCfs = cfs.length >= nToShow;
      const maxN = neighbors.length >= nToShow;
      if(!maxCfs & isCf){
        cfs.push(nData);
      } else if(!maxN & !isCf){
        neighbors.push(nData);
      }
      if((cfs.length >= nToShow) & (neighbors.length >= nToShow)){
        break
      }
    }
    return [neighbors, cfs]
  }

 

    function makeNeighborView(currEmbeddings,currState,cohortData,simulation,fixedDecisions,brushedId){
        if(Utils.allValid([currEmbeddings,cohortData,simulation])){
        const getSimulation = props.getSimulation;
        const dltSvgPaths=props.dltSvgPaths;
        const subsiteSvgPaths=props.subsiteSvgPaths;
        const lnSvgPaths=props.lnSvgPaths;
      
        let decision = Utils.getDecision(fixedDecisions,currState,getSimulation);
        const dString = constants.DECISIONS[currState];
        var neighborsToShow = 10;
        const [neighbors,cfs] = getNeighbors(decision,currEmbeddings,currState,cohortData,neighborsToShow);

    
          const dname = constants.DECISIONS_SHORT[props.currState];
          function getPatientMeans(plist){
            const meanObj = {};
            for(let obj of plist){
              for(let [key,value] of Object.entries(obj)){
                //skip unknown hpv
                if(key === 'hpv' & value < 0){continue}
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
          const thingHeight = width/(nPerRow*5.3);
          const dltWidth = thingHeight/2;
          const lnWidth = thingHeight*.8;
          const subsiteWidth = thingHeight*.7;
          const nWidth = thingHeight;
          const titleWidth = thingHeight/2;
          const encodedRef = encodePatient(props.patientFeatures);
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
                name = d.id + ': ';
              
                if(d[dString] > .5){
                  name += dname;
                } else{
                  name += 'no ' + dname;
                }
              }
              
            }
            const headerSize = '1em';
            const viewSize = 'calc(100% - ' + headerSize + ' - 10px)';
            const headerStyle = {'width':'100%','height':headerSize};
            const viewStyle   = {'width':'100%','height':viewSize,'marginTop':'10px'}
            const componentStyle = w => {return {'margin':0,'width': w,'height':'100%','display':'inline-block','verticalAlign':'top'}}
            return (
            <div key={d.id+'-'+i+props.currState} 
               style={{'margin':'.2em','height': thingHeight,
               'width': 'auto',
               'diplay': 'inline-flex',
               'justifyContent':'flex-start',
              'marginBottom': marginBottom,
              'borderBottom': bBorder,
              }}
              onClick={()=>brush()}
              >
              <div className={'toggleButtonLabel'} style={{'display':'inline-flex','width': titleWidth,'fontSize':14,'height':'100%','justifyContent':'center','alignItems':'center'}}>
                {name}
              </div>
              {/* <div style={componentStyle(dltWidth)}>
                <div  className={'title'} style={headerStyle}>{"DLTs"}</div>
                <div style={viewStyle}>
                  <DLTVisD3
                    dltSvgPaths={dltSvgPaths}
                    data={d}
                    currState={currState}
                    isMainPatient={false}
                  />
                </div>
                
              </div> */}
              <div style={componentStyle(lnWidth)}>
                <div  className={'title'} style={headerStyle}>{"LN"}</div>
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
                <div  className={'title'} style={headerStyle}>{"Subsite"}</div>
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
                <div  className={'title'} style={headerStyle}>{"Staging"}</div>
                <div style={viewStyle}>
                <NeighborVisD3
                  data={d}
                  referenceData={encodedRef}
                  key={d.id+i}
                  lnSvgPaths={lnSvgPaths}
                  valRanges={ranges}
                  dltSvgPaths={dltSvgPaths}
                  currState={currState}
                  version={'staging'}
                  name={name}
                  showTicks={showTicks}
                ></NeighborVisD3>
                </div>
              </div>
              <div style={componentStyle(nWidth)}>
                <div  className={'title'} style={headerStyle}>{"Baseline"}</div>
                <div style={viewStyle}>
                <NeighborVisD3
                  data={d}
                  referenceData={encodedRef}
                  key={d.id+i}
                  lnSvgPaths={lnSvgPaths}
                  valRanges={ranges}
                  dltSvgPaths={dltSvgPaths}
                  currState={currState}
                  version={'useful'}
                  name={name}
                  showTicks={showTicks}
                ></NeighborVisD3>
                </div>
              </div>
              <div style={componentStyle(nWidth)}>
                <div  className={'title'} style={headerStyle}>{"Outcomes"}</div>
                <div style={viewStyle}>
                <NeighborVisD3
                  data={d}
                  referenceData={undefined}
                  key={d.id+i+'outcomes'}
                  lnSvgPaths={lnSvgPaths}
                  valRanges={ranges}
                  dltSvgPaths={dltSvgPaths}
                  currState={currState}
                  version={'outcomes'}
                  name={name}
                  showTicks={showTicks}
                ></NeighborVisD3>
                </div>
              </div>
            </div>
            )
          }
          const nStuff = p.map((d,i) => makeN(d,i,false));
    
          if(nPerRow < 2){
            return (
              <div className={'centerText scroll'} style={{'width':'100%!important','height':'100%',
                      'display':'inline-flex','flexFlow':'row wrap','flexDirection':'row','alignItems':'flex-start'}}>
                  {makeN(meanTreated,'n',true)}
                  {makeN(meanUntreated,'cf',true)}
                  <hr style={{'width':'100%','display':'block','marginTop':'10px'}}></hr>
                  {nStuff}
              </div>
              );
          } else{
            return (<div className={'fillSpace'}>
              <div className={'scroll'} style={{'width':'49%','height':'100%',
                      'display':'inline-flex','flexFlow':'row wrap','flexDirection':'row','alignItems':'flex-start'}}>
                  {makeN(meanUntreated,'cf',true)}
                  <hr style={{'width':'100%','display':'block','marginTop':'10px'}}></hr>
                  {nStuff}
              </div>
              <div className={'scroll'} style={{'width':'49%','height':'100%',
                      'display':'inline-flex','flexFlow':'row wrap','flexDirection':'row','alignItems':'flex-start'}}>
                  {makeN(meanUntreated,'cf',true)}
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
        if(props.simulation !== undefined){
          if(props.simulation[props.modelOutput] !== undefined){
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
        }
      else{
        return (<Spinner/>)
      }
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
                <div style={{'height':'6em','width': '100%','display':'flex','alignItems':'center','justifyContent':'center'}}>
                    <img src={'scatterplot_legend.PNG'} style={{'maxHeight':'90%','maxWidth':'90%'}}/>
                </div>
            </div>
            
        );
      }

    function makeSurvivalPlot(props){
      if(Utils.allValid([props.simulation,props.cohortData,props.currEmbeddings])){
        let decision = Utils.getDecision(props.fixedDecisions,props.currState,props.getSimulation);
        const dString = constants.DECISIONS[props.currState];
        var neighborsToShow = 20;
        const [sim,altSim] = props.getSimulation(true);
        const [neighbors,cfs,caliperVal] = Utils.getTreatmentGroups(sim,props.currEmbeddings,props.cohortData,props.currState,props.cohortEmbeddings);
        // const [neighbors,cfs] = getNeighbors(decision,props.currEmbeddings,props.currState,props.cohortData);
        
        return (
          <div key={'survival'} className={'fillSpace'}>
            <SurvivalPlots 
            neighbors={neighbors}
            sim={sim}
            altSim={altSim}
            cfs={cfs}
            decision={decision}
            dString={dString}
            {...props}
            />
          </div>
        )
      } else{
        return (<Spinner/>)
      }

    }

      function outcomeToggle(){
        var htext = HelpTexts.attributionHelpText;
        if(auxView === 'scatterplot'){
          htext = HelpTexts.scatterplotHelpText
        } else if(auxView === 'neighbors'){
          htext = HelpTexts.simHelpText;
        }
        return (<>
          {Utils.makeStateToggles(auxViewOptions,auxView,setAuxView,auxViewLabels)}
          <HelpText key={auxView} text={htext}/>
        </>);
      }

      const currView = useMemo(()=>{
        switch(auxView){
            case 'neighbors':
                return makeNeighborView(props.currEmbeddings,props.currState,props.cohortData,props.simulation,props.fixedDecisions,props.modelOutput,props.brushedId);
                break;
            case 'scatterplot':
                return makeScatterplot(props);
                break;
            case 'survival':
              return makeSurvivalPlot(props);
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