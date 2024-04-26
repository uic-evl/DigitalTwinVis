import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'
import Dose2dCenterViewD3 from './Dose2dCenterViewD3.js';

export default function ClusterSymptomsD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [drawn, setDrawn] = useState(false);

    // const plotSymptoms = ['drymouth','voice','teeth','taste','nausea','choke','vomit','pain','mucus','mucositis']
    const minWeeks = 33;
    const maxWeeks = -1;


    const thresholds = [5];;
    const getThresholdColor = x => d3.interpolateBlues(x/thresholds[thresholds.length-1]);
    const lineFunc = d3.line(d=>d[0],d=>d[1])
    const angleIncrement = 2*Math.PI/props.plotSymptoms.length;
    
    const margin = 1;
    const radius = Math.min(height/2 - margin,width/2 - margin);
    const valueRange = [0,10];
    const scaleTransform = x => .9*x + 1;

    function significanceColor(p,effectSize){
        if(p > .05 | effectSize < 1){
            return '#af8dc3';
        } else if(p > .01){
            return '#d94801'
        } else{
            return '#8c2d04'
        }
    }

    function pol2rect(r, θ) { 
        let x = r*Math.cos(θ) + width/2;
        let y = r*Math.sin(θ) + height/2;
        return [x,y];
    }
    function coordinateTransform(sname,value){
        let angle = props.plotSymptoms.indexOf(sname)*angleIncrement;
        let r = radius*value/valueRange[1];
        return pol2rect(r,angle)
    }

    useEffect(function drawAxes(){
        if(svg !== undefined){
            // console.log('drawing axes')
            const axLineFunc = d3.line()
                .x(d => d[0])
                .y(d => d[1]);
    
            svg.selectAll('.axisGroup').remove();
            var axisGroup = svg.append('g').attr('class','axisGroup');
            var axisPaths = [];
            var endpoints = []
            for(let symptom of props.plotSymptoms){
                let [x0,y0] = coordinateTransform(symptom,0);
                let [x1,y1] = coordinateTransform(symptom,valueRange[1]);
                let axPath = axLineFunc([[x0,y0],[x1,y1]]);
                axisPaths.push({
                    'path': axPath,
                    'symptom': symptom,
                });
                endpoints.push({
                    'x': x1,
                    'y': y1,
                    'symptom': symptom,
                });
            }

            var isMain = d => d.symptom === props.mainSymptom;
            axisGroup.selectAll('path')
                .data(axisPaths).enter()
                .append('path')
                .attr('class','axisLine')
                .attr('d',d=>d.path)
                .attr('stroke-width',d=>isMain(d)? 1.5:.5)
                .attr('stroke',d=>isMain(d)? 'black':'grey');

            axisGroup.selectAll('circle')
                .data(endpoints).enter()
                .append('circle')
                .attr('class','axisEndpoint')
                .attr('cx',d=>d.x)
                .attr('cy',d=>d.y)
                .attr('r',d=> isMain(d)? 4:3)
                .attr('fill',d=> isMain(d)? 'blue':'grey')
                .on('mouseover',function(e){
                    let d = d3.select(this).datum();
                    let tipText = d.symptom;
                    tTip.html(tipText);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                }).on('dblclick',function(e){
                    let d = d3.select(this).datum();
                    let s = d.symptom;
                    if(s !== props.mainSymptom){
                        props.setMainSymptom(s);
                    }
                });
        }
    },[svg,height,width,props.plotSymptoms,props.mainSymptom])

    useEffect(function draw(){
        
        if(svg !== undefined & props.data != undefined & height > 0 & width > 0){
            
            setDrawn(false);
            let curveEndpoints = [];
            let linePoints = [];
            let minDateIdx = props.data.dates.indexOf(props.minWeeks);
            let maxDateIdx = minDateIdx;
            if(props.maxWeeks !== undefined){
                let maxDateIdx = props.data.date.indexOf(props.maxWeeks)
                maxDateIdx = Math.min(props.data.dates.length,maxDateIdx);
            }
            for(let symptom of props.plotSymptoms){
                let correlation_key = 'cluster_' + symptom + '_';
                let getCorr = (suffix) => props.data[correlation_key + suffix];
                let entryBase = {
                    'lrt_pval': getCorr('lrt_pval'),
                    'ttest_tval': getCorr('ttest_tval'),
                    'aic_diff': getCorr('aic_diff'),//negative is Good
                    'color': 'white',
                    'symptom': symptom,
                    'clusterSize': props.data.cluster_size,
                    'radius': .1,
                    'odds_ratio_5': props.data['cluster_'+symptom+'_5_odds_ratio'],
                    'odds_ratio_7': props.data['cluster_'+symptom+'_7_odds_ratio'],
                    // 'pval_5': props.data['cluster_'+symptom+'_5_pval'],
                    // 'pval_7': props.data['cluster_'+symptom+'_7_pval'],
                }
                let lineEntry = Object.assign(entryBase,{})
                lineEntry.points = [];

                let vals = props.data[symptom].map(x => x.slice(minDateIdx,maxDateIdx+1));
                let mvals = vals.map( v => Math.max(...v));
                let mean = Utils.mean(mvals);
                let median = Utils.median(mvals);
                let n75 = Utils.quantile(mvals,.75);
                let n25 = Utils.quantile(mvals,.25);
                let valList = [['n25',n25],['mean',median],['n75',n75]]
                for(let [vName, val] of valList){
                    let [x,y] = coordinateTransform(symptom,scaleTransform(val));
                    if(vName === 'mean' & val > .1){
                        let subEntry = Object.assign(entryBase,{});
                        subEntry.x = x;
                        subEntry.y = y;

                        subEntry.value = val;
                        subEntry.name = vName;
                        subEntry.color = significanceColor(subEntry.lrt_pval,subEntry.ttest_tval);
                        subEntry.radius = 2 + 2*Math.max(entryBase.odds_ratio_7,.01)**.5;
                        curveEndpoints.push(subEntry);
                    }else{
                        lineEntry.points.push([x,y])
                    }
                }
                lineEntry.path = lineFunc(lineEntry.points);
                linePoints.push(lineEntry);
            }

            svg.selectAll('g').filter('.symptomCurveGroup').remove();
            var curveGroup = svg.append('g').attr('class','symptomCurveGroup')
            
            curveGroup.selectAll('.symptomLine').remove();
            curveGroup.selectAll('path').filter('.symptomLine')
                .data(linePoints).enter()
                .append('path').attr('class','.symptomLine')
                .attr('d',d=>d.path)
                .attr('stroke','blue')
                .attr('stroke-width',2);

            curveGroup.selectAll('.symptomEndpoint').remove()
            curveGroup.selectAll('circle').filter('.symptomEndpoint')
                .data(curveEndpoints).enter()
                .append('circle').attr('class','symptomEndpoint')
                .attr('cx',d=>d.x)
                .attr('cy',d=>d.y)
                .attr('r',d=>d.radius)
                .attr('fill',d=>d.color)
                .attr('opacity',d=> (d.lrt_pval > .05)? .8: 1)
                .attr('stroke', 'black')
                .attr('stroke-width',1)
                .attr('stroke-opacity',d=> (d.pval > .05)? 0: 1)
                .on('mouseover',function(e){
                    let d = d3.select(this).datum();
                    if(d === undefined){return;}
                    let tipText = d.symptom + '</br>' 
                        + d.name + ': ' + d.value + '</br>'
                        + 'aic improvement: ' + (-d.aic_diff).toFixed(2) + '</br>' 
                        + 'lrt tval: ' + d.ttest_tval.toFixed(2) + '</br>'
                        + 'p = ' + d.lrt_pval.toFixed(3) + '</br>'
                        + 'odds>4: ' + d.odds_ratio_5.toFixed(1) + '</br>'
                        + 'odds>6: ' + d.odds_ratio_7.toFixed(1) + '</br>'
                    tTip.html(tipText);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                }).on('dblclick',function(e){
                    let d = d3.select(this).datum();
                    if(d === undefined){return;}
                    if(d.symptom !== props.mainSymptom){
                        props.setMainSymptom(d.symptom)
                    }
                });;
            setDrawn(true)
        }
            
    },[props.data,svg,props.mainSymptom,props.minWeeks])


    useEffect(function brush(){
        if(svg !== undefined & drawn){
            //brush
        }
    },[props.data,svg,drawn,props.mainSymptom])


    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}