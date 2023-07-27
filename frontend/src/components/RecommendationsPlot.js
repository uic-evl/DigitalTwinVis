import React, {useState, useEffect, useRef, useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";



export default function RecommendationPlot(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);

    const xMargin = 20;
    const yMargin = 10;

    const lineFunc = d3.line();
    const tickHeight = Math.min(30,height*.4);
    const maxNeighbors = 10;


    const xScale = d3.scaleLinear()
        .domain([0,1])
        .range([xMargin,width-2*xMargin]);

    useMemo(()=>{
        if(svg!== undefined){
            const xS = xScale;

            const y = height/2;
            var linePoints = [0,.5,1].map(xv => [[xS(xv),y-tickHeight/2],[xS(xv),y+tickHeight/2]]);
            linePoints.push([[xS(0),y],[xS(1),y]]);

            svg.selectAll('.axisLines').remove();
            svg.selectAll('.axisLines')
                .data(linePoints).enter()
                .append('path').attr('class','axisLines')
                .attr('d',d=> lineFunc(d))
                .attr('stroke','grey')
                .attr('stroke-width',3)
                .attr('fill','none');
        } else{
            return false
        }
    },[svg,height,width]);

    useMemo(()=>{
        if(svg !== undefined & props.decision !== undefined){
            const nDecisions = props.neighborDecisions.slice(0,Math.max(props.neighborDecisions.length,maxNeighbors));
            const nProb = Utils.mean(nDecisions);

            const radius = tickHeight*.5;
            const dEntry = {
                'x': xScale(props.decision),
                'y': height/2,
                'radius': radius,
                'fill': 'teal',
                'value': props.decision,
                'title': 'Rec.'
            }

            const nEntry = {
                'x': xScale(nProb),
                'y': height/2,
                'radius': radius,
                'fill': 'goldenrod',
                'value': nProb,
                'title': 'Sim. Patients'
            }

            svg.selectAll('.decisionMarker').remove();
            svg.selectAll(".decisionMarker")
                .data([dEntry,nEntry]).enter()
                .append('circle').attr('class','decisionMarker')
                .attr('cx',d=>d.x)
                .attr('cy',d=>d.y)
                .attr('fill',d=>d.fill)
                .attr('r',d=>d.radius)
                .attr('opacity',.8);

            const labelSize = Math.min(24,Math.max(radius*.9,12));
            svg.selectAll('text').remove();
            svg.selectAll('.decisionLabel')
                .data([dEntry,nEntry]).enter()
                .append('text').attr('class','decisionLabel')
                .attr('text-anchor','middle')
                .attr('x',d=>d.x)
                .attr('font-size',labelSize)
                .attr('stroke','white')
                .attr('stroke-width',.01)
                .attr('font-weight','bold')
                .attr('y',d=> d.y + labelSize/4)// - d.radius - labelSize/2)
                .text(d=> (d.value*100).toFixed(0) + '%');

            svg.selectAll('.decisionLabel2')
                .data([dEntry,nEntry]).enter()
                .append('text').attr('class','decisionLabel2')
                .attr('text-anchor','middle')
                .attr('x',d=>d.x)
                .attr('font-size',labelSize*.75)
                .attr('y',d=> d.y + d.radius + labelSize)
                .text(d=> d.title);    
        }
    },[svg,props.decision,props.neighborDecisions])    

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}