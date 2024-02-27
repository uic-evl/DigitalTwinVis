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
import OtherOutcomes from './OtherOutcomes.js';

import {Spinner} from '@chakra-ui/react';


export default function OutcomeContainer(props){

    const outcomeViewOptions = props.currState < 2? ['survival','endpoints','dlts','disease response']: ['survival','endpoints'];
    const [outcomesView, setOutcomesView] = useState(outcomeViewOptions[outcomeViewOptions.length-1]);
    const [view,setView] = useState('survival');
    const viewOptions = ['survival','other'];
    const viewNames = ['Survival Curves','All Outcomes']
    const [outcomesToShow,setOutcomesToShow] = useState([
      'Treatment (predicted)',
      // 'No Treatment (predicted)',
      // 'Treatment (neighbors)',
      'No Treatment (neighbors)'
    ])

    // const outcomeViewOptions = props.currState < 2? ['survival','all','endpoints','disease response','dlts','no dlts']: ['survival','endpoints'];
    function makeOutcomeToggle(){
        return Utils.makeStateToggles(outcomeViewOptions,outcomesView,setOutcomesView,undefined,undefined);
    }

    function makeMainToggle(){
      return Utils.makeStateToggles(viewOptions,view,setView,viewNames,undefined);
    }

    const data = useMemo(()=>{
      if(Utils.allValid([props.simulation,props.cohortData,props.currEmbeddings,props.cohortEmbeddings])){
        let decision = Utils.getDecision(props.fixedDecisions,props.currState,props.getSimulation);
        if(decision == undefined){return (<Spinner/>)}
        const dString = constants.DECISIONS[props.currState];

        const [sim,altSim] = props.getSimulation(true);
        const [neighbors,cfs,caliperVal] = Utils.getTreatmentGroups(sim,props.currEmbeddings,props.cohortData,props.currState,props.cohortEmbeddings);
        return {'sim': sim, 'altSim': altSim,'neighbors': neighbors, 'cfs': cfs,'decision': decision}
      }
      return {}
    },[props.simulation,props.cohortData,props.currEmbeddings,props.cohortEmbeddings,props.modelOutput,props.currState,props.fixedDecisions])


    const [rowOffsets,setRowOffsets] = useState([0,0]);
    const rowHeights = ['80%','20%'];
    function getRowHeight(index){
      const offset = rowOffsets[index];
      const sign = offset > 0? ' + ': ' - ';
      const string = 'calc(' + rowHeights[index] + ' - 1.5em' + sign + Math.abs(offset) + 'px)';
      return string
    }

    function getView(v){
      if(v === 'survival'){
        return (
        <>
        <div className={'shadow'} style={{'height':getRowHeight(0),'width':'100%'}}>
        <div style={{'height': '4em','width': '100%'}}>
            <ModelLegend state={props.currState}
              outcomesToShow={outcomesToShow}
              setOutcomesToShow={setOutcomesToShow}
            />'
        </div>
        <div style={{'height': 'calc(100% - 4em)','width':'100%'}} className={'noGutter'}>
          <div className={'fillSpace'} style={{'overflowX':'hidden'}}>
              <div key={'survival'} style={{'height':'100%','width':'100%'}}>
                <SurvivalPlots 
                sim={data.sim}
                altSim={data.altSim}
                neighbors={data.neighbors}
                cfs={data.cfs}
                decision={data.decision}
                dString={constants.DECISIONS[props.currState]}
                outcomesToShow={outcomesToShow}
                {...props}
                />
              </div>
          </div>
        </div>
      </div>
      <div style={{'height':'1em','width':'100%'}}>
      <DraggableComponentY 
        setColAdjust={setRowOffsets} 
        colAdjust={rowOffsets}
        index={0}/>
      </div>

      <div className={'shadow'} style={{'height':getRowHeight(1),'width':'100%'}}>
      <div style={{'height': '1em','width':'100%','margin':'0px'}}>
        <HelpText text={HelpTexts.outcomeHelpText}/>
            {makeOutcomeToggle()}
        </div>
          <div style={{'height':'calc(100% - 1.7em)','width':'98%','margin':'.5%','overflow':'hidden'}}>
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
      </>
      )
      }
      if(v === 'other'){
        return (<div style={{'height':'calc(100% - 2.5em)','width':'100%'}}>
          <div style={{'height': '4em','width': '100%'}}>
              <ModelLegend state={props.currState}
                outcomesToShow={outcomesToShow}
                setOutcomesToShow={setOutcomesToShow}
              />'
          </div>
          <div style={{'height':'calc(100% - 4em)','width':'100%','overflowY':'scroll'}}>
            <OtherOutcomes
              className={'shadow'}
              sim={data.sim}
              altSim={data.altSim}
              neighbors={data.neighbors}
              cfs={data.cfs}
              decision={data.decision}
              outcomesView={outcomesView}
              state={props.currState}
              outcomesToShow={outcomesToShow}
              {...props}
            ></OtherOutcomes>
          </div>
        </div>)
      }
    }

    //for some reason ths re-renders the survival plots when I change outcomesView?
    const plot = ()=>{
      if(data === undefined || data.sim === undefined){
        return <Spinner/>
      }
      return(
        <div className={'fillSpace noGutter'}>
          <div style={{'width':'100%','height':'2em'}}>
            {makeMainToggle()}
          </div>
          {getView(view)}
        </div>
      )
    }
 
    return (<>{plot()}</>)
      
}

const DraggableComponentY = (props) => {
  const [pressed, setPressed] = useState(false)
  const [position, setPosition] = useState(0);
  const [startPosition, setStartPosition] = useState(0);

  const [linePosition,setLinePosition] = useState(0);
  const [lineHeight,setLineHeight] = useState(0);
  const ref = useRef()

  // Update the current position if mouse is down
  const upDatePosition = (event,target) => {
    if (ref.current) {
      var moveY = (event.clientY - startPosition);
      if(Math.abs(moveY) > window.screen.height/2){
        moveY = Math.sign(moveY) * (window.screen.height/2);
      }
      var newAdjusts = [...props.colAdjust];
      newAdjusts[props.index] = newAdjusts[props.index] + moveY;
      newAdjusts[props.index+1] = newAdjusts[props.index+1] - moveY;
      props.setColAdjust(newAdjusts);
    }
    setPressed(false);
    setStartPosition(event.clientY);
  }

  const startDrag  = (event) => {
    setStartPosition(event.clientY);
    setPressed(true)
  }

  const style = Object.assign({'cursor':'pointer','width':'100%','height':'100%'},props.style)

  return (
    <div
      draggable={true}
      ref={ ref }
      style={ style }
      onDragEnd={upDatePosition}
      onMouseDown={ startDrag }
    >
      <svg style={{'width':'100%','height':'100%'}}>
        <rect width={ref.current? ref.current.clientWidth: '50%'} height={'80%'} fill="black" y={'10%'} x={0}/>
      </svg>
    </div>
  )
}