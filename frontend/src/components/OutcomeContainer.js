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
import AuxOutcomeBarchart from './AuxOutcomeBarchart.js';
import AuxOutcomeKiviat from './AuxOutcomeKiviat.js';

import {Spinner} from '@chakra-ui/react';


export default function OutcomeContainer(props){

    const outcomeViewOptions = props.currState < 2? ['survival','endpoints','dlts','disease response']: ['survival','endpoints'];
    const [outcomesView, setOutcomesView] = useState(outcomeViewOptions[outcomeViewOptions.length-1]);
    // const outcomeViewOptions = props.currState < 2? ['survival','all','endpoints','disease response','dlts','no dlts']: ['survival','endpoints'];
    function makeOutcomeToggle(){
        return Utils.makeStateToggles(outcomeViewOptions,outcomesView,setOutcomesView);
    }

    const data = useMemo(()=>{
      if(Utils.allValid([props.simulation,props.cohortData,props.currEmbeddings])){
        let decision = Utils.getDecision(props.fixedDecisions,props.currState,props.getSimulation);
        if(decision == undefined){return (<Spinner/>)}
        const dString = constants.DECISIONS[props.currState];

        const [sim,altSim] = props.getSimulation(true);
        const [neighbors,cfs,caliperVal] = Utils.getTreatmentGroups(sim,props.currEmbeddings,props.cohortData,props.currState,props.cohortEmbeddings);
        return {'sim': sim, 'altSim': altSim,'neighbors': neighbors, 'cfs': cfs,'decision': decision}
      }
      return {}
    },[props.simulation,props.cohortData,props.currEmbeddings,props.cohortEmbeddings,props.modelOutput,props.currState,props.fixedDecisions])


    //for some reason ths re-renders the survival plots when I change outcomesView?
    const plot = ()=>{
      if(data === undefined || data.sim === undefined){
        return <Spinner/>
      }
      return(
        <>
        <div style={{'height': '4em','width': '100%'}}>
            <ModelLegend state={props.currState}/>'
        </div>
        <div style={{'height': 'calc(100% - 4em)','width':'100%'}} className={'noGutter'}>
        <div className={'fillSpace'} style={{'overflowX':'hidden'}}>
            <div key={'survival'} style={{'height':'calc(100% - 12em)','width':'100%'}}>
              <SurvivalPlots 
              sim={data.sim}
              altSim={data.altSim}
              neighbors={data.neighbors}
              cfs={data.cfs}
              decision={data.decision}
              dString={constants.DECISIONS[props.currState]}
              {...props}
              />
            </div>
            <div style={{'height': '1.5em','width':'100%'}}>
            <HelpText text={HelpTexts.outcomeHelpText}/>
                {makeOutcomeToggle()}
            </div>
              <div style={{'height':'10em','width':'98%','margin':'.5%','overflow':'hidden'}}>
                <AuxOutcomeBarchart
                  className={'shadow'}
                  sim={data.sim}
                  altSim={data.altSim}
                  neighbors={data.neighbors}
                  cfs={data.cfs}
                  decision={data.decision}
                  currState={props.currState}
                  outcomesView={outcomesView}
                />
              </div>
              </div>
          </div>
        </>
      )
    }
 
    return (<>{plot()}</>)
      
}