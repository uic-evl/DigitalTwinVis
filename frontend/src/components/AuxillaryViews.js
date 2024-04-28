import React, {useState, useEffect, useRef, useMemo} from 'react';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";
import AttributionPlotD3 from './AttributionPlotD3.js';
import ScatterPlotD3 from './ScatterPlotD3.js';
import NeighborView from './NeighborView.js';
import AttributionLegend from './AttributionLegend.js';
import SurvivalPlots from './SurvivalPlots.js';
import Symptoms from './Symptoms.js';
import {Spinner} from '@chakra-ui/react';


import * as HelpTexts from '../modules/Text';
import HelpText from '../modules/HelpText';

export default function AuxillaryViews(props){

    const container = useRef();

    const auxViewOptions = ['attributions','symptoms','neighbors','scatterplot'];
    const auxViewLabels =['Features','Symptoms','Similar','Scatterplot']
    // const auxViewOptions = ['survival','attributions','neighbors','scatterplot'];
    // const auxViewLabels =['Survival','Feature Importance','Similar Patients','Scatterplot']
    const [auxView,setAuxView] = useState(props.defaultView? props.defaultView:'attributions');

    const showToggle = props.showToggle === undefined? true:props.showToggle;


    
    function makeNeighborView(p){
      return <NeighborView {...p} container={container}></NeighborView>
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
      if(Utils.allValid([props.simulation,props.cohortData,props.currEmbeddings,props.cohortEmbeddings])){
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

    function makeSymptomPlot(props){

      if(Utils.allValid([props.symptoms])){
        return <Symptoms
          {...props}
        ></Symptoms>
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
        } else if(auxView === 'symptoms'){
          htext = 'Plots of predicted patient symptoms after the start of radiation treatment (in weeks). Dark green lines represent treated patient mean values and light green indicate untreated mean values (for current IC/CC/ND decision). Faint lines represent patients used in the prediction'
        }
        if(!showToggle){
          return <span style={{'display':'inline-block'}}>
            <p className="title" style={{'display':'inline'}}>{Utils.getVarDisplayName(auxView)}</p>
            <HelpText key={auxView} text={htext}/>  
          </span>
        }


        return (<>
          {Utils.makeStateToggles(auxViewOptions,auxView,setAuxView,auxViewLabels)}
          {window.innerWidth > 500? <HelpText key={auxView} text={htext}/>: <></>}
        </>);
      }

      const [currView,setCurrView] = useState();

      function makeView(v,p){
        switch(v){
            case 'neighbors':
                return makeNeighborView(p);
                break;
            case 'scatterplot':
                return makeScatterplot(p);
                break;
            case 'survival':
              return makeSurvivalPlot(p);
              break;
            case 'symptoms':
              return makeSymptomPlot(p);
              break;
            default:
                return makeAttributionPlot(p);
        }
    }
    useEffect(()=>{
      setCurrView(makeView(auxView,props));
    },[props,auxView])

    return ( 
            <div className={'fillSpace'} ref={container}>
            <div style={{'height':'2.5em','width':'100%'}}>
                {outcomeToggle()}
            </div>
            <div key={props.currState+auxView} style={{'height':'calc(100% - 2.6em)','width':'100%'}}>
                {currView}
            </div>
            </div>
    );
}