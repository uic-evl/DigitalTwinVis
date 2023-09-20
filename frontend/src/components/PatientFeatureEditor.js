import React, {useState, useEffect, useRef, useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";

export default function PatientFeatureEditor(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);

    const margin = 5;

    useEffect(()=>{
        if(svg === undefined | props.data === undefined){return}
        // console.log('editor',props)
        const data = props.data;
        const barWidth = (width - 2*margin)/data.ticks.length;
        var currX = margin;
        var rectData = [];
        const key = data.name;
        var queVal = props.encodedFeatureQue[data.name];
        queVal = queVal === undefined? -2: queVal;
        for(let i in data.ticks){
            i = parseInt(i);
            let xx = data.ticks[i];
            let val = xx;
            if(constants.booleanVars.indexOf(key) > -1){
                val = val > 0? 'Y':'N';
            } else if(key == 'hpv'){
                val = val > 0? 'Y': val < 0? '?':'N';
            }
            else if(constants.continuousVars.indexOf(key) > -1){
                let minVal = data.ticks[i];
                let fixVal = minVal > 10? 0:1;
                if(i+ 1 < data.ticks.length){
                    let maxVal =  data.ticks[i+1] - .1;
                    val = '[' +  (0+minVal).toFixed(fixVal) + '-' + (0+maxVal).toFixed(fixVal) + ')';
                } else{
                    val = (0+minVal).toFixed(fixVal) + '+'
                }    
            }
            else if(constants.ordinalVars[key] !== undefined){
                val = val.toFixed(0);
            } else if(constants.progressionVars[key] !== undefined){
                val = constants.progressionVars[key][Math.round(val)];
                val = val.replace('Nodal','').replace('Primary','').replace(' ','');
            }
            const xNext = i < data.ticks.length-1? data.ticks[i+1]: Infinity;
            const isActive = data.currValue >= xx & data.currValue < xNext;
            const isQueued = queVal >= xx & queVal < xNext;
            rectData.push({
                'x': currX,
                'width': barWidth,
                'value': xx,
                'displayValue': val,
                'active': isActive,
                'queued': isQueued,
                'name':key,
            })
            currX+=barWidth;
        }

        let rects = svg.selectAll('.featureRect').data(rectData,d=>d.displayValue);
        rects.enter()
            .append("rect").attr('class','featureRect clickable')
            .merge(rects)
            .attr('x',d=>d.x).attr('width',d=>d.width)
            .attr('y',margin).attr('height',height-2*margin)
            .attr('fill','grey').attr('fill-opacity',d=>d.active?.5:0)
            .style('cursor',d=>d.active? 'default':'pointer')
            .attr('rx',6)
            .attr('stroke','black').attr('stroke-width',d=>d.queued? 3:.4);
        rects.exit().remove();

        let rectLabels = svg.selectAll('.label').data(rectData,d=>d.displayValue);
        rectLabels.enter()
            .append("text").attr('class','label clickable')
            .merge(rectLabels)
            .attr('x',d=>d.x+.5*d.width)
            .attr('y',height*.6).attr('text-anchor','middle')
            .attr('font-size',height/3)
            .style('cursor',d=>d.active? 'default':'pointer')
            .text(d=>d.displayValue);

        svg.selectAll('.clickable')
            .on('click',(e,d)=>{
                if(d.active){return}
                const newQ = Object.assign({},props.featureQue)
                if(constants.ordinalVars[data.name] !== undefined){
                    let vals = constants.ordinalVars[data.name];
                    for(let v of vals){
                        newQ[data.name+'_'+parseInt(v)] = (parseInt(d.value) === parseInt(v)) + 0;
                    }
                } else if(constants.progressionVars[data.name] !== undefined){
                    let vals = constants.progressionVars[data.name];
                    for(let i in vals){
                        i = parseInt(i)
                        newQ[vals[i]] = (i === parseInt(d.value)) + 0
                    }
                }
                else{
                    newQ[data.name] = d.value;
                }
                console.log('click',e,d,data.name,props.featureQue,newQ);
                props.setFeatureQue(newQ);
            })
        rectLabels.exit().remove();
    },[props,svg])


    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}