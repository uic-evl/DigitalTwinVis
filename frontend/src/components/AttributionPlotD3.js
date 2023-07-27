import React, {useState, useEffect, useRef,useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";



export default function AttributionPlotD3(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    
    const margin = 20;
    const labelSpacing = 80;
    const topMargin = 50;

    const minAttribution = 0.001;

    useMemo(()=>{
        if(svg !== undefined & props.simulation !== undefined){
            const res = props.simulation[props.modelOutput]['decision'+(props.currState+1)+'_attention'];
            var validKeys = ['baseline','dlt1','dlt2','nd','pd'];
            // so commenting this will let me see if I get attributions it should get
            if(props.currState == 1){
                validKeys = ['baseline','dlt1','nd','pd']
            } else if(props.currState == 2){
                validKeys = ['baseline','dlt1','nd','pd']
            }
            var data = {};
            var positiveTotal = 0;
            var negativeTotal = 0;
            for(let key of validKeys){
                let newData = res[key];
                if(newData === undefined){
                    console.log('key invalid',key,res);
                    continue
                }
                for(const [key2,val] of Object.entries(newData)){
                    if(Math.abs(val) > minAttribution){
                        data[key2] = val;
                        if(val > 0){
                            positiveTotal += Math.abs(val);
                        } else{
                            negativeTotal += Math.abs(val);
                        }
                    }
                }
            }
            //data should now be a dictionayr of values
            const keys = Object.keys(data);
            const attributions = Object.values(data);



            const amplitude = Math.max(positiveTotal,negativeTotal,.01);
            // const aExtents = d3.extent(attributions);
            // const amplitude = Math.abs(Math.max(-aExtents[0],aExtents[1]));
            const xScale = d3.scaleLinear()
                .domain([0,amplitude])
                .range([width/2,width-margin]);
            // const centerX = negativeTotal > positiveTotal? labelSpacing + xScale(negativeTotal) - xScale(positiveTotal): labelSpacing;
            const centerX = width/2;
            const colorScale = d3.scaleDiverging()
                .domain([-amplitude,0,amplitude])
                .range(['blue','white','red']);

            const barWidth = (height - margin - topMargin)/(attributions.length);
            
            //modified from https://stackoverflow.com/questions/46622486/what-is-the-javascript-equivalent-of-numpy-argsort
            //to actually return args with the last map function
            const argsort = (arr1, arr2) => arr1
                .map((item, index) => [arr2[index], item]) // add the args to sort by
                .sort(([arg1], [arg2]) => arg2 - arg1) // sort by the args
                .map(([, item]) => item)
                .map(item => arr1.indexOf(item)); //extract sorted items
            const sortedIdx = argsort(keys,attributions);
            var rectData = [];
            var yPos = topMargin;
            var currX = centerX;
            for(const idx of sortedIdx){
                const varName = keys[idx];
                const attribution = attributions[idx];
                let x = currX;
                const w = xScale(Math.abs(attribution)) - width/2;
                if(attribution < 0){
                    x = x - w;
                }
                const entry = {
                    'name': varName,
                    'val': attribution,
                    'width': w,
                    'x': x,
                    'y': yPos,
                    'height': barWidth-1,
                }
                rectData.push(entry);
                if(attribution > 0){
                    currX = currX + w;
                } else{
                    currX = currX - w;
                }
                yPos += barWidth;
            }


            svg.selectAll('.aRect').remove();
            svg.selectAll('.aRect')
                .data(rectData).enter()
                .append('rect').attr('class','aRect')
                .attr('x',d=>d.x)
                .attr('y',d=>d.y)
                .attr('width',d=>d.width)
                .attr('height',d=>d.height)
                .attr('fill',d=> colorScale(d.val))
                .attr('stroke-width',1)
                .attr('stroke','black');

            const labelSize = Math.min(20,barWidth);
            svg.selectAll('text').remove();
            svg.selectAll('.labelRect')
                .data(rectData).enter()
                .append('text').attr('class','labelRect')
                .attr('x',2)
                .attr('y',d=>d.y + labelSize)
                .attr('text-anchor','start')
                .attr('font-size',labelSize)
                .text(d=>Utils.getFeatureDisplayName(d.name))
        }
    },[svg,props.simulation,props.modelOutput,props.currState,width,height]);

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}