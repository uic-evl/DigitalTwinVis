import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'

export default function QueLegend(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const xMargin = 10;
    const yMargin = 10;
    const barMargin = 3;
    const strokeWidth = 4;
    const titleSize = Math.max(5,width/8);

    const legendMap = {
        current: 'current clust.',
        cue: 'queued clust.',
        both: 'current + next',
        none: 'none',
    }

    function getText(t){
        let text = legendMap[t];
        return (text === undefined)? Utils.getVarDisplayName(t): text;
    }

    useEffect(function draw(){
        if(svg !== undefined & props.parameterColors !== undefined){
            const colors = props.parameterColors;
            const chartHeight = height;
            const chartWidth = Math.min(chartHeight/3, width/2);


            const barHeight = (chartHeight - 2*yMargin)/(Object.values(colors).length) - barMargin - strokeWidth;
            const barWidth = Math.min(barHeight, chartWidth/2);
            
            var currY = yMargin + 2*barMargin + titleSize;
            var title = 'Organ Status';
            var legendData = [{
                    y: yMargin - titleSize/2, 
                    color: 'white', 
                    text: title,
                    isTitle:true
                }];
            for(let [k,v] of Object.entries(colors)){
                let text = getText(k);
                let entry = {
                    text: text,
                    color: v,
                    y: currY,
                    isTitle: false,
                }
                legendData.push(entry);
                currY += barHeight + barMargin + strokeWidth;
            }

            svg.selectAll('.legendRect').remove();
            svg.selectAll('.legendRect')
                .data(legendData).enter()
                .append('rect').attr('class','legendRect')
                .attr('x',xMargin)
                .attr('y',d=>d.y)
                .attr('height',barHeight)
                .attr('width',barWidth)
                .attr('fill','none')
                .attr('stroke',d=>d.color)
                .attr('visibility',d=>d.isTitle? 'hidden':'visible')
                .attr('stroke-width',strokeWidth);

            svg.selectAll('.legendText').remove();
            svg.selectAll('.legendText')
                .data(legendData).enter()
                .append('text').attr('class','legendText')
                .attr('x',d=>d.isTitle? xMargin : xMargin + barMargin + barWidth)
                .attr('y',d=>d.y + (barHeight/2))
                .attr('text-align','start')
                .attr('alignment-baseline','middle')
                .attr('font-size',d=>d.isTitle? titleSize:titleSize*.8)
                .attr('font-weight',d=>d.isTitle? 'bold':'')
                .text(d=>d.text);
            }   
    },[svg,props])
    
    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}