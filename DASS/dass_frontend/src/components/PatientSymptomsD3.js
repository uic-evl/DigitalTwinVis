import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'

export default function ClusterSymptomsD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [drawn, setDrawn] = useState(false);

    const maxXLabelSize = 16;

    const yMargin = 5;
    const xMargin = 5;
    const sideTextMargin = 20;
    const spacing = 2;

    const timeSteps = [
        [0,1],
        [2,3,4,5,6,7],
        [13,33],
    ];

    const getColor = (v) => {
        if(v < 3){
            return 'lightblue';
        }else if(v < 5){
            return '#fc8d59';
        } else if(v < 7){
            return '#d7301f';
        } 
        return '#7f0000'
    }
    function getAggSymptom(d,symptom, dates){
        let s = d['symptoms_'+symptom];
        if(s === undefined){
            console.log('bad symptom',d,symptom,dates)
            return 0
        }
        let dVals = dates.map(i => s[d.dates.indexOf(i)]);
        return Math.max(...dVals)
    }

    useEffect(function draw(){
        
        if(svg !== undefined & props.data != undefined & height > 0 & width > 0){
            const nRows = Object.keys(props.plotSymptoms).length;
            console.log(props.plotSymptoms);
            const rowHeight = ((height - 2*yMargin - maxXLabelSize)/(nRows)) - spacing;
            const xLabelSize = Math.min(maxXLabelSize, rowHeight*.8);
            const chartHeight = rowHeight - spacing;
            const toPlot = props.plotSymptoms.filter(s => props.data['symptoms_'+s] !== undefined);
            const barWidth = (width-2*xMargin - sideTextMargin)/(timeSteps.length)
            const yScale = d3.scaleLinear()
                .domain([0,10])
                .range([1,chartHeight]);

            const getX = (i) => {
                return barWidth*i+xMargin+sideTextMargin;
            }
            const getY = (i) => {
                return yMargin + rowHeight*i;
            }

            var plotData = [];
            let textData = [];
            for(let i in toPlot){
                let s = toPlot[i];
                let baseY = getY(i);
                let yLabel = {
                    'x': xMargin,
                    'y': baseY + xLabelSize/2 + chartHeight/2,
                    'text': s.substring(0,4),
                    'anchor': 'start',
                    'scale': 1,
                }
                textData.push(yLabel)
                for(let ii in timeSteps){
                    let x = getX(ii);
                    let weeks = timeSteps[ii];
                    if(i == 0){
                        let wString = weeks[0] + '-' + weeks[weeks.length-1]
                        let xLabel = {
                            'x': x+2,
                            'anchor': 'start',
                            'y': height - xLabelSize,
                            'text': wString,
                            'scale': .8,
                        }
                        textData.push(xLabel);
                    }
                    let sVal = getAggSymptom(props.data,s,weeks)
                    let entry = {
                        'value': sVal,
                        'weeks': weeks,
                        'symptom': s,
                        'x': x,
                        'height': yScale(sVal),
                        'y': baseY + chartHeight - yScale(sVal),
                        'color':getColor(sVal),
                        'baseY': baseY,
                    }
                    plotData.push(entry)
                }
            }
            svg.selectAll('rect').filter('.symptomRect').remove();
            svg.selectAll('rect').filter('.symptomRect')
                .data(plotData).enter()
                .append('rect').attr('class','symptomRect')
                .attr('x',d=>d.x)
                .attr('y',d=>d.y)
                .attr('width',barWidth)
                .attr('height',d=>d.height)
                .attr('fill',d=>d.color);

            svg.selectAll('rect').filter('.symptomOverlayRect').remove();
            svg.selectAll('rect').filter('.symptomOverlayRect')
                .data(plotData).enter()
                .append('rect').attr('class','symptomOverlayRect')
                .attr('x',d=>d.x)
                .attr('y',d=>d.baseY)
                .attr('width',barWidth)
                .attr('height',chartHeight)
                .attr('fill-opacity',0)
                .on('mouseover',function(e){
                    let d = d3.select(this).datum();
                    let tipText = 'max ' + d.symptom + ' at ' 
                    +  d.weeks[0] + '-' + d.weeks[d.weeks.length-1] + ' wks: '
                        + d.value;
                    tTip.html(tipText);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                }).on('dblclick',function(e){
                    let d = d3.select(this).datum();
                    if(props.activeCluster !== d.cluster){
                        props.setActiveCluster(d.cluster)
                    }
                });

            svg.selectAll('text').remove();
            svg.selectAll('text').data(textData)
                .enter().append('text').attr('class','psAxisText')
                .attr('x',d=>d.x)
                .attr('y',d=>d.y)
                .attr('font-size',d=>d.scale*xLabelSize)
                .attr('text-anchor',d=>d.anchor)
                .html(d=>d.text);
            // const dateIdxs = props.data.dates.map(time)

        }
            
    },[props.data,svg,props.plotSymptoms])


    useEffect(function brush(){
        if(svg !== undefined & drawn){
            //brush here
        }
    },[props.data,svg,drawn])


    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}