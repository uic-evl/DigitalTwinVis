import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'

export default function EffectViewLegendD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const xMargin = 10;
    const yMargin = 10;
    const barMargin = 2;
    const useChange = props.useChange;
    const titleSize = Math.max(12,width/8);

    useEffect(function draw(){
        if(svg !== undefined & props.extents !== undefined){
            const data = props.effectData;
            
            const chartHeight = Math.min(height, 200);
            const chartWidth = Math.min(chartHeight/3, width);
            const topOffset = (height - chartHeight)/4;

            const metric = props.colorMetric;
            var metricTransform = x => -x;
            if(metric.includes('pval')){
                metricTransform = x => -(1/x);
            }
            var inverseTransform = metricTransform;
            const [minVal,maxVal] = props.extents;
            var steps = [minVal, (3*minVal + maxVal)/4, (minVal + 3*maxVal)/4,maxVal]
            let colorScale = d3.scaleLinear()
                .domain([minVal,maxVal])
                .range([0,1])
            let interp = props.linearInterpolator;

            if(minVal < 0){
                colorScale = d3.scaleDiverging()
                    .domain([minVal,0,maxVal])
                    .range([0,.5,1])
                interp = props.divergentInterpolator;
                if(maxVal > 0){
                    steps = [minVal, minVal/2,0,maxVal/2,maxVal];
                }
            }
            const getColor = (val) =>{
                return interp(colorScale(val))
            }

            const barHeight = (chartHeight - 2*yMargin)/(steps.length + 1);
            const barWidth = Math.min(barHeight, chartWidth/2);
            var currY = topOffset + yMargin + 2*barMargin + titleSize;
            var title = Utils.getVarDisplayName(props.colorMetric)
            title = title.replace('diff','penalty'); // make bic diff => bic penalty to convey lower bic is good
            if(props.useChange){
                title = 'Δ' + title;
            }
            var legendData = [{y: topOffset + yMargin - titleSize, color: 'white', text: title,isTitle:true}];
            for(let i in steps){
                let v = steps[i]
                //inverse trnasform of the value and truncate
                let original = (v===0)? 0:inverseTransform(v);
                let text = (Math.abs(original) < .01 & original !== 0)? original.toFixed(4): original.toFixed(1);
                if(i == 0){ text += ' (worst)'}
                else if(i == steps.length-1){ text += ' (best)'}
                let entry = {
                    y: currY,
                    color: getColor(v),
                    text: text,
                    isTitle: false,
                }
                legendData.push(entry);
                currY += barHeight + barMargin;
            }

            svg.selectAll('.legendRect').remove();
            svg.selectAll('.legendRect')
                .data(legendData).enter()
                .append('rect').attr('class','legendRect')
                .attr('x',xMargin)
                .attr('y',d=>d.y)
                .attr('height',barHeight)
                .attr('width',barWidth)
                .attr('fill',d=>d.color)
                .attr('stroke','black')
                .attr('visibility',d=>d.isTitle? 'hidden':'visible')
                .attr('stroke-width',.5);

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