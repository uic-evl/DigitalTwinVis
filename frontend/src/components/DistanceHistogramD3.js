import React, {useState, useEffect, useRef,useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";



export default function DistanceHistogram(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    
    const margin = 20;
    const topMargin = Math.max(height/10,5);
    const bottomMargin = Math.max(height/10,10);

    function ordinalSuffix(i) {
        //get the suffix for a percentile number ie .4 => 40th
        i = (i*100).toFixed(0)
        var j = i % 10,
            k = i % 100;
        if (j == 1 && k != 11) {
            return i + "st";
        }
        if (j == 2 && k != 12) {
            return i + "nd";
        }
        if (j == 3 && k != 13) {
            return i + "rd";
        }
        return i + "th";
    }

    useMemo(()=>{
        if(svg !== undefined & props.mDists !== undefined & props.currEmbeddings !== undefined){
            const distances = props.mDists[props.currState];
            const currDist = props.currEmbeddings.mahalanobisDistance;
            const extents = d3.extent([currDist].concat(distances));
            const binData = [];
            const increment = .05;
            var maxCount = 0;
            var cumSum = 0;
            var currPercentile = 1;
            var totalAbove = distances.length;
            for(let i = 0; i <= 1; i+=increment){
                const binMin = extents[0]*(1-i) + extents[1]*i;
                const ii = i + increment;
                const binMax = extents[0]*(1-ii) + extents[1]*ii;
                const inBin = distances.filter(v => (v >= binMin) & (v < binMax)).length;
                maxCount = Math.max(maxCount,inBin);
                totalAbove -= inBin;
                binData.push({
                    'count': inBin,
                    'i': i,
                    'binMax':binMax,
                    'binMin': binMin,
                    'histVal': Math.max(totalAbove,0),
                });
                cumSum += inBin;
                if(currDist >= binMin & currDist < binMax){
                    currPercentile = cumSum/distances.length;
                }
            }

            const xScale = d3.scaleLinear()
                .domain(extents)
                .range([margin,width-margin]);

            const functionalHeight = height - bottomMargin - topMargin;
            const heightScale = d3.scaleLinear()
                .domain([0,distances.length])
                .range([0,functionalHeight]);

            const colorScale = d3.scaleLinear()
                .domain([distances.length,0.05])
                .range(['#99d594','black'])
            const bars = svg.selectAll('.histBar').data(binData,d=>d.x);
            
            bars.enter().append('rect')
                .attr('class','histBar')
                .merge(bars)
                .attr('x',d=> xScale(d.binMin))
                .attr('width',d=>Math.max(xScale(d.binMax) - xScale(d.binMin),0))
                .attr('y',d=> topMargin + (functionalHeight - heightScale(d.histVal)))
                .attr('fill',d=>colorScale(d.histVal))
                .attr('opacity',1)
                .transition(500)
                .attr('height',d=>heightScale(d.histVal))
        
            bars.exit().remove();

            const patientX = xScale(currDist);
            const patientLine = [[patientX,topMargin],[patientX,height-bottomMargin]];
            const pLine = svg.selectAll('.patientLine').data([patientLine],(d,i)=>i);

            function getColor(){
                if(currPercentile >= .95){
                    return '#7f3b08';
                } else if(currPercentile >= .85){
                    return '#e08214'
                } else if(currPercentile > .5){
                    return '#666666'; 
                }
                return 'blue';
            }

            pLine.enter().append('path')
                .attr('class','patientLine')
                .merge(pLine)
                .attr('fill','none')
                .attr('stroke',getColor())
                .attr('stroke-width',5)
                .transition(1000)
                .attr('d',d=>d3.line()(d));

            pLine.exit().remove();

            const labelSize = Math.min(12,topMargin/2);
            svg.selectAll('.label').remove();

            function getLabel(cp){
                let string = ordinalSuffix(cp) + ' percentile';
                if(cp > .95){
                    string += '⚠';
                } else if(cp < .5){
                    string += '☺'
                } else if(cp > .75){
                    string += '☹';
                } else{
                    string += '😐';
                }
                return string
            }
            svg.append('text').attr('class','label')
                .attr('x', patientX > width/2? patientX - 5: patientX + 5).attr('y',topMargin+labelSize+5)
                .attr('text-anchor',patientX > width/2? 'end':'start')
                .attr('fontSize',labelSize)
                .attr('font-weight','bold')
                .attr('stroke','white').attr('stroke-width',.01)
                .text(getLabel(currPercentile))

            pLine.raise();
        }
    },[svg,,props.currState,width,height,props.mDists,props.currEmbeddings]);

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}