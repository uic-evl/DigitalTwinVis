import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'

export default function FeatureEffectViewD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const xMargin = 10;
    const yMargin = 10;
    const barMargin = 2;
    const useChange = props.useChange;

    useEffect(function draw(){
        if(svg !== undefined & props.effectData !== undefined & props.extents !== undefined){
            const data = props.effectData;
            const maxWidth = (width - 2*xMargin)/(data.length)
            const maxHeight = (height - 2*yMargin);
            
            const metric = props.colorMetric;
            var metricTransform = x => -x;
            if(metric.includes('pval')){
                metricTransform = x => -(1/x);
            }
            var getValue = (d) => {
                if(d === undefined){
                    return undefined;
                } else if(d[metric] === undefined){
                    return undefined;
                }
                let v = d[metric];
                let baselineValue = d[metric+'_base']
                if(useChange &  baselineValue !== undefined){
                    v = v - baselineValue;
                }
                return metricTransform(v)
            }

            
            const [minVal,maxVal] = props.extents;
            let colorScale = d3.scaleLinear()
                .domain([minVal,maxVal])
                .range([0,1])
            let interp = props.linearInterpolator;

            if(minVal < 0){
                colorScale = d3.scaleDiverging()
                    .domain([minVal,0,maxVal])
                    .range([0,.5,1])
                interp = props.divergentInterpolator;
            }
            const getColor = (val) =>{
                return interp(colorScale(val))
            }

            let xPos = xMargin;
            let entries = [];
            const keys = [
                'aic_diff','aic_diff_base',
                'bic_diff','bic_diff_base',
                'lrt_pval','lrt_pval_base',
                'featurePos','features',
                'cluster','symptom',
            ]
            for(let d of data){
                let val = getValue(d);
                let name = 'V' + d.featurePos;
                //feature pos is usually the Vx value with 99 and 100 for mean and max dose as special cases I added in later and couldn't think of a better scheme
                if(parseInt(d.featurePos) == 99){
                    name = 'mean';
                } else if(parseInt(d.featurePos) == 100){
                    name = 'max';
                }
                let entry = {
                    'x': xPos,
                    'y': yMargin,
                    'height': maxHeight,
                    'width': maxWidth-barMargin,
                    'value': val,
                    'color': getColor(val),
                    'name': name,
                }
                for(let key of keys){
                    if(d[key] !== undefined){
                        entry[key] = d[key];
                    }
                }
                entries.push(entry);
                xPos = xPos + entry.width + barMargin;
            }

            const getStrokeColor = d => {
                let inFeatures = props.clusterFeatures.indexOf(d.name) >= 0;
                let inCue = props.tempClusterFeatures.indexOf(d.name) >= 0;
                if(inFeatures & inCue){ return props.parameterColors.both; } 
                if(inFeatures){ return props.parameterColors.current; }
                if(inCue){ return props.parameterColors.cue; }
                return props.parameterColors.none;
            }

            const getStroke = d => {
                let inFeatures = props.clusterFeatures.indexOf(d.name) >= 0;
                let inCue = props.tempClusterFeatures.indexOf(d.name) >= 0;
                if(inFeatures | inCue){ return barMargin; }
                return .01;
            }

            svg.selectAll('rect').filter('.dvhRect').remove();
            svg.selectAll('rect').filter('.dvhRect')
                .data(entries).enter()
                .append('rect').attr('class','dvhRect')
                .attr('x',d=>d.x)
                .attr('y',d=>d.y)
                .attr('height',d=>d.height)
                .attr('width',d=>d.width)
                .attr('fill',d=>d.color)
                .attr('stroke', getStrokeColor)
                .attr('stroke-width',getStroke)
                .on('mouseover',function(e){
                    let d = d3.select(this).datum();
                    let tipText = '';
                    for(let key of keys){
                        if(d[key] !== undefined){
                            tipText += key + ': '+ d[key] + '</br>';
                        }
                    }
                    tTip.html(tipText);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                }).on('contextmenu', function(e){
                    e.preventDefault();
                    let d = d3.select(this).datum();
                    // e.stopPropagation();
                    if(d !== undefined){
                        props.toggleClusterFeature(d.name);
                        Utils.hideTTip(tTip);
                    }
                });

            const fontsize = Math.min(maxWidth/3,maxHeight/2)
            svg.selectAll('text').filter('.dvhText').remove();
            svg.selectAll('text').filter('.dvhText')
                .data(entries).enter()
                .append('text').attr('class','dvhText')
                .attr('x',d=>d.x + (fontsize/2))
                .attr('y',d=>d.y+(d.height/2))
                .attr('font-size',fontsize)
                .style('pointer-events','none')
                .html(d=>d.name)
                .on('contextmenu',function(e){
                    e.stopPropogation();
                });

            svg.style('cursor','pointer')
        }
    },[svg,props])
    
    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}