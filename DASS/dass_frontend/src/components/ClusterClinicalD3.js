import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'
export default function ClusterClinicalD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [drawn, setDrawn] = useState(false);

    const maxXLabelSize = 12;

    const yMargin = 5;
    const xMargin = 5;
    const sideTextMargin = 40;
    const spacing = 2;

    const interpolator = d3.interpolateGreys;

    useEffect(function draw(){
        
        if(svg !== undefined & props.data != undefined & height > 0 & width > 0){
            const size = props.data.cluster_size;
            const nRows = Object.keys(props.plotValues).length;
            const rowHeight = ((height - 2*yMargin)/(nRows)) - spacing;
            const xLabelSize = Math.min(maxXLabelSize, rowHeight*.3);
            const chartHeight = rowHeight - xLabelSize;

            var rectData = [];
            var textData = [];
            let currY = 0;
            for(let varName of Object.keys(props.plotValues)){
                let uniqueValues = props.plotValues[varName];
                let barWidth = (width-2*xMargin-sideTextMargin)/uniqueValues.length;
                let counts = {}
                let maxVal = 0;
                for(let value of uniqueValues){
                    counts[value] = 0;
                }
                let clustVals = props.data[varName];
                for(let val of clustVals){
                    if(uniqueValues.indexOf(val) < 0){continue;}
                    counts[val] = counts[val] + 1;
                    maxVal = Math.max(counts[val],maxVal);
                }
                let yScale = d3.scaleLinear()
                    .domain([0,size])
                    .range([0,chartHeight]);
                let getColor = v => interpolator(.5 + .4*v/size)
                let currX = xMargin + sideTextMargin;
                for(let [key,count] of Object.entries(counts)){
                    let h = yScale(count);
                    let entry = {
                        'x': currX,
                        'y': currY + rowHeight - h,
                        'height': h,
                        'baseY': currY,
                        'name': key,
                        'rowName': varName,
                        'width': barWidth,
                        'color': getColor(count),
                        'count': count,
                        'total': size,
                    }
                    rectData.push(entry);

                    let textEntry = {
                        'x': currX + barWidth/2,
                        'y': currY + rowHeight + xLabelSize,
                        'text': key,
                        'weight': 'normal',
                        'maxWidth': barWidth,
                    }
                    textData.push(textEntry);
                    currX += barWidth;
                }
                let rowLabel = {
                    'x': sideTextMargin/2,
                    'y': currY +  rowHeight/2 + xLabelSize,
                    'text': varName.replace('is_','').replace('_',''),
                    'weight': 'bold',
                    'maxWidth': sideTextMargin,
                }
                textData.push(rowLabel)
                currY += rowHeight + spacing;
            }

            svg.selectAll('rect').filter('.histRect').remove();
            svg.selectAll('rect').filter('.histRect')
                .data(rectData).enter()
                .append('rect').attr('class','histRect')
                .attr('x',d=>d.x)
                .attr('y',d=>d.y)
                .attr('height',d=>d.height)
                .attr('width',d=>d.width)
                .attr('fill',d=>d.color)
            
            //overaly so you brush by mousing over the whitespace as well
            svg.selectAll('rect').filter('.histRectOverlay').remove();
            svg.selectAll('rect').filter('.histRectOverlay')
                .data(rectData).enter()
                .append('rect').attr('class','histRect')
                .attr('x',d=>d.x)
                .attr('y',d=>d.baseY)
                .attr('height',rowHeight)
                .attr('width',d=>d.width)
                .attr('fill-opacity',0)
                .on('mouseover',function(e){
                    let d = d3.select(this).datum();
                    let tipText =d.rowName + '=' + d.name + ':</br>' 
                        + d.count + '/' + d.total + ' (' + (100*d.count/d.total).toFixed(1) + '%)'
                    tTip.html(tipText);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                })

            svg.selectAll('text').filter('.histText').remove();
            svg.selectAll('text').filter('.histText')
                .data(textData).enter()
                .append('text').attr('class','histText')
                .attr('x',d=>d.x)
                .attr('y',d=>d.y)
                .attr('font-size',xLabelSize)
                .attr('text-anchor','middle')
                .attr('font-weight',d=>d.weight)
                // .attr('textLength',d=>d.maxWidth)
                .html(d=>d.text.substring(0,4));
        }
            
    },[props.data,props.plotValues,svg])


    useEffect(function brush(){
        if(svg !== undefined & drawn){
            //stuff here
        }
    },[svg,drawn])


    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}