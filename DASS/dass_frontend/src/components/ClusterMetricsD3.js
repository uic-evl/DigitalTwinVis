import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'

export default function ClusterMetricsD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [rectsDrawn,setRectsDrawn] = useState(false);
    const yMarginTop = Math.min(40,height/10);
    const yMarginBottom = Math.min(40,height/10);
    const xMargin = 30;
    const barMargin = 2;
    const chartMargin = 40;

    const binaryMetric = 'odds_ratio';
    const linearMetric = 'aic_diff';
    const pvalMetric = 'lrt_pval';

    function getKey(metric, threshold){
        let key = 'cluster_' + props.mainSymptom + '_';
        if(threshold < 0){
            key += 'change_';
        }
        if(Math.abs(threshold) > 1){
            key += Math.abs(threshold) + '_';
            if(props.endpointDates !== undefined){
                for(let endpoint of props.endpointDates){
                    key += endpoint;
                }
                key += 'wks_';
            }
        }
        
        key += metric;
        return key;
    }

    function makeTitle(key, threshold){
        let title = '';//Utils.getVarDisplayName(key);
        if(threshold < 0){
            title =  title + ' Δ';
        }
        if(Math.abs(threshold) > 1){
            title += '>' + (Math.abs(threshold) - 1);
        } 
        else{
            title += ' linear';
        }
        return title;
    }

    useEffect(function format(){
        
        if(svg != undefined & props.metricData !== undefined){
            // console.log('data',props.metricData,props.thresholds,props.mainSymptom,props.endpointDates)
            var data = [];
            var titleData = [];
            let maxVal = {'binary': 0, 'linear': 0};
            let minVal = {'binary': Infinity, 'linear': Infinity};
            const chartWidth = (width-2*xMargin)/(props.thresholds.length) - chartMargin;
            const barWidth = (chartWidth/props.metricData.length) - barMargin;
            var currX = xMargin; 
            for(let thold of props.thresholds){
                let isLinear =  (Math.abs(thold) <= 1);
                let metric = isLinear? linearMetric:binaryMetric;
                let key = getKey(metric, thold);
                let pKey = getKey(pvalMetric,thold);
                let titleEntry = {
                    'x': currX + chartWidth/2,
                    'text': makeTitle(metric, thold),
                }
                titleData.push(titleEntry);
                for(let clusterEntry of props.metricData){
                    let value = clusterEntry[key];
                    if(value === undefined){
                        // console.log('invalid key', key, clusterEntry);
                        continue;
                    }
                    let pVal = clusterEntry[pKey];
                    // if(pVal === undefined){
                    //     console.log(pVal, pKey, clusterEntry)
                    // }
                    let clusterId = clusterEntry.clusterId;
                    let color = (pVal < .05)? props.categoricalColors(clusterId): 'grey';
                    if(metric.includes('odds_ratio')){
                        value = (value - 1);
                    } else if(metric.includes('aic_') | metric.includes('bic_')){
                        value = -value;
                    }
                    let entry = {
                        'value': value,
                        'baseValue':  clusterEntry[key],
                        'metric': metric,
                        'isLinear': isLinear,
                        'threshold': thold,
                        'key': key,
                        'pval': pVal,
                        'change': thold < 0,
                        'color': color,
                        'x': currX,
                        'cluster':clusterId,
                    }
                    currX += barWidth + barMargin;
                    let vKey = isLinear? 'linear': 'binary';
                    maxVal[vKey] = Math.max(maxVal[vKey], value);
                    minVal[vKey] = Math.min(minVal[vKey], value);
                    data.push(entry);
                }
                currX += chartMargin;
            }
            // console.log('formattedData ', data, maxVal, minVal)

            //why are barcharts actually the hardest to prrogram
            
            let h = height - yMarginBottom - yMarginTop;

            function makeScale(isLinear){
                let vKey = isLinear? 'linear': 'binary';
                let mxVal = maxVal[vKey]
                let mnVal = minVal[vKey];
                // if(mxVal > 0){
                //     mnVal = Math.min(0,mnVal);
                // }
                let topVal = Math.max(Math.abs(mxVal),Math.abs(mnVal))
                // let topRatio = topVal/(Math.abs(mxVal)+Math.abs(mnVal));
                let topRatio = Math.abs(mxVal)/(Math.abs(mxVal)+Math.abs(mnVal));
                let yCenter = h*topRatio;
                let maxHeight = Math.max(yCenter - yMarginTop, h - yCenter)

                let scale = d3.scaleLinear()
                    .domain([0,topVal])
                    .range([0,maxHeight]);

                if(maxVal <= 0){
                    scale = d3.scaleLinear()
                        .domain([0,Math.abs(mnVal)])
                        .range([0,h])
                }

                var yScale = d => {
                    return scale(Math.abs(d.value));
                }; 

                let getYPos = (d) => {
                    if(d.value < 0){
                        return yCenter;
                    } else{
                        return yCenter-yScale(d);
                    }
                }

                return {
                    'scale': scale,
                    'yCenter': yCenter,
                    'yScale': yScale,
                    'getYPos': getYPos,
                }
            }
            
            var scales = {
                'linear': makeScale(true),
                'binary': makeScale(false),
            }

            var yScale = (d) => {
                if(d.isLinear){
                    return scales.linear.yScale(d);
                } else{
                    return scales.binary.yScale(d);
                }
            }

            var getYPos = (d) => {
                if(d.isLinear){
                    return scales.linear.getYPos(d);
                } else{
                    return scales.binary.getYPos(d);
                }
            }


            svg.selectAll('rect').remove();
            let rects = svg.selectAll('rect').filter('.metricRect')
                    .data(data).enter()
                    .append('rect')
                    .attr('class','metricRect')
                    .attr('y',getYPos)
                    .attr('x',d=>d.x)
                    .attr('width',barWidth)
                    .attr('fill',d=>d.color)
                    .attr('fill-opacity',1)
                    .attr('height',yScale)
                    .attr('stroke','black')
                    .attr('stroke-width',0)
                    .on('mouseover',function(e){
                        let d = d3.select(this).datum();
                        let tipText = '';
                        for(let key of Object.keys(d)){
                            tipText += key + ': ' + d[key] + '</br>';
                        }
                        tTip.html(tipText);
                    }).on('mousemove', function(e){
                        Utils.moveTTipEvent(tTip,e);
                    }).on('mouseout', function(e){
                        Utils.hideTTip(tTip);
                    });

            var getTextY = d => {
                if(d.value < 0){
                    let y = getYPos(d) + yScale(d) - 5;
                    // y = Math.max(yCenter+20,y)
                    return y;
                } else{
                    let y = Math.max(getYPos(d)-5,20+yMarginTop);
                    return y;
                }
            }
            let formatNum = (n) => {
                n = n.toFixed(3);
                n = n.replace(/^0+/, '')
                n = n.replace(/^-0+/, '-')
                n = n.replace(/0+$/, '0')
                n = n.replace(/.$/, '')
                return n+'';
            }
                
            svg.selectAll('text').filter('.annotation').remove();
            let annotation = svg.selectAll('text').filter('.annotation')
                .data(data).enter().append('text')
                .attr('class','annotation')
                .attr('x',d=>d.x + barWidth/2)
                .attr('text-anchor','middle')
                .attr('y',getTextY)
                .style('font-size',Math.min(25,barWidth/2.2))
                .html(d=>formatNum(d.value));

            svg.selectAll('text').filter('.title').remove();
            const titleSize = Math.max(15,Math.min(barWidth/1.5,yMarginBottom/1.5));
            
            let titleText = svg.selectAll('text').filter('.title')
                .data(titleData).enter().append('text')
                .attr('class','title')
                .attr('x',d=>d.x)
                .attr('y', height-(2.1*titleSize))
                .attr('text-anchor','middle')
                // .attr('aligment-baseline','bottom')
                .style('font-size',titleSize)
                .text(d=>d.text)
          
            setRectsDrawn(true);
        }
    },[svg,props.metricData,props.mainSymptom,props.endpointDates,props.thresholds])

    useEffect(function brush(){
        if(!rectsDrawn){ return; }
        var getStrokeWidth = (d) => (d.cluster === props.activeCluster)? 3:0;
        svg.selectAll('.metricRect')
            .attr('stroke-width',getStrokeWidth)
            .on('dblclick',function(e){
                let d = d3.select(this).datum();
                if(parseInt(props.activeCluster) !== parseInt(d.cluster)){
                    props.setActiveCluster(parseInt(d.cluster));
                }
            });

        svg.selectAll('text').raise();
    },[props.activeCluster,rectsDrawn])

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}
