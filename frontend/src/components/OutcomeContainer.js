import React, {useState, useEffect, useRef,useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";
import OutcomePlots from './OutcomePlots.js';
import SurvivalPlots from './SurvivalPlots.js';
import * as HelpTexts from '../modules/Text';
import HelpText from '../modules/HelpText';
import ModelLegend from './ModelLegend.js';
import AuxOutcomePlot from './AuxOutcomePlot.js';

import {Spinner} from '@chakra-ui/react';


export default function OutcomeContainer(props){

    const outcomeViewOptions = props.currState < 2? ['survival','endpoints','dlts','disease response']: ['survival','endpoints'];
    const [outcomesView, setOutcomesView] = useState(outcomeViewOptions[outcomeViewOptions.length-1]);
    // const outcomeViewOptions = props.currState < 2? ['survival','all','endpoints','disease response','dlts','no dlts']: ['survival','endpoints'];
    function makeOutcomeToggle(){
        return Utils.makeStateToggles(outcomeViewOptions,outcomesView,setOutcomesView);
    }

    function makeOutcomes(simulation,cohortData,currEmbeddings,cohortEmbeddings,modelOutput,getSimulation,currState){
        if(Utils.allValid([simulation,cohortData,currEmbeddings,cohortEmbeddings])){
            if((simulation[modelOutput] === undefined)){return  (<Spinner/>)}
      
      
            //so the code here triese to pull the patients with the smallest caliper distance (likelihood of being treated)
            //from the treated and untreated groups. We start at .1*std(logit(chort propensities)) and gradually increase (for each group individuall) until we get enough people
            //todo: there's probably a better way to do this using sorting? also maybe show propensity match somewhere?
      
            const [sim,altSim] = getSimulation(true);
      
            const [neighbors,cfs,caliperVal] = Utils.getTreatmentGroups(sim,currEmbeddings,cohortData,currState,cohortEmbeddings);
            const currDecision = sim.currDecision;
      
            var outcomes = constants.OUTCOMES.concat(constants.TEMPORAL_OUTCOMES);
            if(currState == 0){
              outcomes = outcomes.concat(constants.dlts1);
              outcomes = outcomes.concat(constants.primaryDiseaseProgressions);
              outcomes = outcomes.concat(constants.nodalDiseaseProgressions);
            } else if(currState == 1){
              outcomes = outcomes.concat(constants.dlts2);
              outcomes = outcomes.concat(constants.primaryDiseaseProgressions2);
              outcomes = outcomes.concat(constants.nodalDiseaseProgressions2);
            }
            var neighborPredictions = {};
            var cfPredictions = {};
            for(let key of outcomes){
              neighborPredictions[key] = Utils.mean(neighbors.map(d=>d[key]));
              cfPredictions[key] = Utils.mean(cfs.map(d=>d[key]));
            }

            return (
              <OutcomePlots
                sim={sim}
                altSim={altSim}
                neighborOutcomes={neighborPredictions}
                counterfactualOutcomes={cfPredictions}
                mainDecision={currDecision}
                state={currState}
                outcomesView={outcomesView}
              ></OutcomePlots>
            )
          } else{
            return (<Spinner/>)
          }
    }

    

    function makeSurvivalPlot(){
        if(Utils.allValid([props.simulation,props.cohortData,props.currEmbeddings])){
          let decision = Utils.getDecision(props.fixedDecisions,props.currState,props.getSimulation);
          if(decision == undefined){return (<Spinner/>)}
          const dString = constants.DECISIONS[props.currState];

          const [sim,altSim] = props.getSimulation(true);
          const [neighbors,cfs,caliperVal] = Utils.getTreatmentGroups(sim,props.currEmbeddings,props.cohortData,props.currState,props.cohortEmbeddings);
        //   const [neighbors,cfs] = Utils.getNeighbors(decision,props.currEmbeddings,props.currState,props.cohortData,neighborsToShow);
          return (
            <div className={'fillSpace'} style={{'overflowX':'hidden'}}>
            <div key={'survival'} style={{'height':'78%','width':'100%'}}>
              <SurvivalPlots 
              sim={sim}
              altSim={altSim}
              neighbors={neighbors}
              cfs={cfs}
              decision={decision}
              dString={dString}
              {...props}
              />
            </div>
            <div style={{'height':'19%','width':'98%','margin':'.5%','overflow':'hidden'}}>
              <AuxOutcomePlot
                className={'shadow'}
                sim={sim}
                altSim={altSim}
                neighbors={neighbors}
                cfs={cfs}
                decision={decision}
                currState={props.currState}
              />
            </div>
            </div>
          )
        } else{
          return (<Spinner/>)
        }
    }

    const plot = useMemo(()=>{
        if(outcomesView === 'survival'){
            return makeSurvivalPlot();
        } 
        return makeOutcomes(props.simulation,props.cohortData,props.currEmbeddings,props.cohortEmbeddings,props.modelOutput,props.getSimulation,props.currState);
    },[props.simulation,props.cohortData,props.currEmbeddings,props.cohortEmbeddings,props.modelOutput,props.currState,props.fixedDecisions,outcomesView])


    return (
        <>
        <div style={{'height': '1.5em','width':'100%'}}>
          <HelpText text={HelpTexts.outcomeHelpText}/>
              {makeOutcomeToggle()}
        </div>
        <div style={{'height': '4em','width': '100%'}}>
            <ModelLegend state={props.currState}/>'
        </div>
        <div style={{'height': 'calc(100% - 5.5em)','width':'100%'}} className={'noGutter'}>
          {plot}
        </div>
        </>
        )
      
}