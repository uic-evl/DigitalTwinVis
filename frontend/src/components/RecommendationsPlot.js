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


    const maxNeighbors = 10;
    const textWidth = Math.max(20,width/7);

    const xScale = d3.scaleLinear()
        .domain([0,1])
        .range([xMargin + textWidth, width-(2*xMargin)-textWidth]);

    const barMargin = 4;
    const barWidth = (height - 2*yMargin - 2*barMargin)/2;
    const names = ['Model','Neighbors'];
    const colors = [[constants.dnnColor,constants.dnnColorNo],[constants.knnColor,constants.knnColorNo]];

    const pieChart = false;

    function makeBarchart(){
        const nDecisions = props.neighborDecisions.slice(0,Math.max(props.neighborDecisions.length,maxNeighbors));
        const nProb = Utils.mean(nDecisions);

        var currY = yMargin;
        const decisions = [props.decision,nProb];
        var bardata = [];
        const dName = constants.DECISIONS_SHORT[props.state];
        for(let i in decisions){
            let d = decisions[i];
            let dval = d > .5? d: 1-d;
            let tName = names[i]
            let rName = d < .5? 'No '+ dName: dName;
            let cIndex = d > .5? 0:1;
            bardata.push({
                'x': xScale(0),
                'width': xScale(dval),
                'y': currY,
                'height': barWidth,
                'text': tName,
                'label':(100*dval).toFixed(0)+'% ' + rName,
                'color': colors[i][cIndex],
                'maxWidth': xScale(1),
            })
            currY += barWidth + barMargin;
        }
        svg.selectAll().remove();
        let bars = svg.selectAll('.bars').data(bardata,d=>d.text);
        bars.enter()
            .append('rect').attr('class','bars')
            .merge(bars)
            .attr('x',d=>d.x).attr('y',d=>d.y)
            .attr('height',d=>d.height)
            .transition(300)
            .attr('width',d=>d.width)
            .attr('fill',d=>d.color);
        bars.exit().remove();

        let outlines = svg.selectAll('.outlines').data(bardata,d=>d.text);
        if(outlines.empty()){
            outlines.enter()
                .append('rect').attr('class','outlines')
                .attr('x',d=>d.x).attr('y',d=>d.y)
                .attr('width',d=>d.maxWidth).attr('height',d=>d.height)
                .attr('fill','none')
                .attr('stroke','black')
                
                .attr('stroke-width',d=>2);
        }
        outlines.exit().remove();

        let text = svg.selectAll('.labels').data(bardata,d=>d.text);
        text.enter()
            .append('text').attr('class','labels')
            .merge(text)
            .attr('x',textWidth + xMargin/1.5).attr('y',d=>d.y+(d.height/2))
            .attr('font-size',Math.min(barWidth-4,textWidth/5))
            .style('dominant-baseline','middle')
            .style('text-anchor','end')
            .text(d=>d.text);

        let annotations = svg.selectAll('.annotations').data(bardata,d=>d.text);
        annotations.enter()
            .append('text').attr('class','annotations')
            .merge(annotations)
            .attr('x',d=>(d.width+d.x)-textWidth/3).attr('y',d=>d.y+(d.height/2))
            .attr('font-size',textWidth/5)
            .attr('font-weight','bold')
            .style('dominant-baseline','middle')
            .style('text-anchor','end')
            .text(d=>d.label);
    }

    function makePieCharts(){
        console.log('whyyyyy');
        svg.selectAll().remove();
    }
    useMemo(()=>{

        if(svg === undefined | props.decision === undefined){return}
        if(pieChart){
            makePieCharts()
        } else{
            makeBarchart();
        }
    },[svg,props.decision,props.neighborDecisions,props.state])


    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}