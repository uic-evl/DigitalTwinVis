import React, {useState, useEffect, useRef, useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";



export default function SurvivalPlots(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);

    const curvesToPlot = constants.TEMPORAL_OUTCOMES;
    
    const xMargin = 10;
    const yMargin = 10;
    useEffect(()=>{
        if(svg === undefined){return}
        const [sim,altSim] = props.getSimulation(true)
        const survivalCurves = sim['survival_curves'];
        const altCurves = altSim['survival_curves'];

        const chartHeight = (height/curvesToPlot.length) - 2*yMargin;
        const chartWidth = width - 2*xMargin;
        const times = survivalCurves.times;
        const xScale = d3.scaleLinear()
            .domain([times[0],times[times.length-1]])
            .range([xMargin,width-xMargin]);

        const lineColors = sim.currDecision >= .5? [constants.yesColor,constants.noColor]: [constants.noColor,constants.yesColor];
        function makeChart(name,topPos){
            const curves = survivalCurves[name];
            const alt = altCurves[name]
            const timeToEvent = sim[name];
            const timeToEventUpper = sim[name+'_95%'];
            const timeToEventLower = sim[name+'_95%'];

            const yScale = d3.scaleLinear()
                .domain([0,1])
                .range([topPos + chartHeight, topPos]);
            const lineFunc = d3.line()
                .x((d,i) => xScale(times[i]))
                .y(d=>yScale(d));

            const selector=name.replace('.','').replace(')','').replace('(','').replace('.','').replace(' ','').replace(' ','')
            var path = svg.selectAll('path').filter('.path'+selector).data([curves,alt],(d,i) => i);

            path.enter()
                .append('path').attr('class','path'+selector)
                .merge(path)
                .transition(100)
                .attr('d',lineFunc)
                .attr('stroke-width',3)
                .attr('stroke',(d,i)=>lineColors[i])
                .attr('fill','none');
            path.exit().remove();
        }
        var currPos = yMargin;
        for(let cName of curvesToPlot){
            makeChart(cName,currPos);
            currPos += chartHeight + 2*yMargin;
        }
        console.log('survivalplot',survivalCurves,altCurves,sim.currDecision,altSim.currDecision)
    },[svg,props])

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}