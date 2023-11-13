import React, {useState, useEffect, useRef} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";


export default function LNVisD3(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const useAttention = props.useAttention === undefined? false: props.useAttention;

    const aScale = v => v//Math.sign(v)*(Math.abs(v)**.3);

    const keepAspectRatio = true;

    const getStrokeWidth = (d)=>{
        if(d.name === 'outline'){ return 3;}
        //nochange or que is empt for this node
        if(d.value === d.queVal | d.queVal < 0){ return .1; }
        return 2;
    }

    useEffect(()=>{
        if(Utils.allValid([svg,props.lnSvgPaths,props.data])){
            let getColorVal = (name,d) => {
                let val = d[name];
                val = val === undefined? 0: val;
                return val
            }
            let getAttention = (name) => 0;

            // let colorScale = useAttention? Utils.getColorScale('attributions',-.5,1.5): Utils.getColorScale('grey',0,1);
            let colorScale = d3.scaleLinear()
                .domain([0,1]).range(['white','black']);
            if(useAttention & Utils.allValid([props.modelOutput,props.simulation])){
                if(props.simulation[props.modelOutput] !== undefined){
                    if(props.fixedDecisions[props.state] < 0){
                        let key = props.modelOutput;
                        for(let i in props.fixedDecisions){
                            let d = props.fixedDecisions[i];
                            let di = parseInt(i) + 1
                            if(d >= 0){
                                let suffix = '_decision'+(di)+'-'+d;
                                key += suffix;
                            }
                        }
                        const attributions = props.simulation[key]['decision'+(props.state + 1)+'_attention'];
                        colorScale = Utils.getColorScale('attributions',attributions.range[0],attributions.range[1]);
                        getAttention = name => attributions.baseline[name];
                        getColorVal = (name,d) =>{
                            return aScale(getAttention(name));
                        }
                    }
                }
            }

            const getColor = d => {
                if(d.name === 'outline'){ return 'none';}
                if(d.colorVal === 0){ return 'white'}
                return colorScale(d.colorVal);
                // if(d.queVal > -1){
                //     return colorScale(d.queVal);
                // }
                // return colorScale(d.value);
            }

            let pathData = [];
            const data = props.data;
            for(const [name,path] of Object.entries(props.lnSvgPaths)){
                if(name.includes('RPN')){continue}
                let val = data[name];
                let queVal = props.featureQue === undefined? -1:props.featureQue[name];
                queVal = queVal === undefined? -1: queVal;
                val = val === undefined? -1: val;
                const att = getAttention(name);
                let entry = {
                    'name': name,
                    'path': path,
                    'value': val,
                    'queVal': queVal,
                    'isContra': name.includes('contra'),
                    'attention': att === undefined? 0: att,
                    'colorVal': getColorVal(name,data),
                }
                pathData.push(entry)
            }
            svg.selectAll('.lnOutline').remove();
            svg.selectAll('.lnGroup').remove();

            let outlineGroup = svg.append('g').attr('class','lnGroup');
            outlineGroup.selectAll('.lnOutline')
                .data(pathData).enter()
                .append('path').attr('class','lnOutline')
                .attr('d',d=>d.path)
                .attr('stroke','black')
                .attr('opacity',1)
                .attr('stroke-width',getStrokeWidth)
                .attr('fill',getColor)
                .on('dblclick',(e,d)=>{
                    if(d.name === 'outline' | !props.isMainPatient){ return; }
                    let val = d.queVal === -1? d.value: d.queVal;
                    let newVal = val < 1? 1: 0;
                    let pFeatures = Object.assign({},props.featureQue);
                    pFeatures[d.name] = newVal;
                    props.setFeatureQue(pFeatures)
                }).on('mouseover',function(e,d){
                    let string = d.name + ': ' + (100*d.value).toFixed(0) + '%';
                    if(useAttention){
                        string = d.name + '</br>'
                        + 'attribution: '+ (100*d.attention).toFixed(3) + '%</br>'
                        + 'current value:' + d.value + '</br>'
                        + 'queued value:' + d.queVal;
                    } 
                    tTip.html(string);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });;

            const box = svg.node().getBBox();
            if(keepAspectRatio){
                const scaleSize = Math.min(width/box.width,height/box.height);
                const xOffset = (width - scaleSize*box.width)/2;
                const yOffset = (height - scaleSize*box.height)/2;
                const translate = 'translate(' + ((-box.x)*(width/box.width) + xOffset) + ',' + ((-box.y)*(height/box.height) + yOffset) + ')'
                const scale = 'scale(' + scaleSize+ ')';
                const transform = translate + ' ' + scale;
                svg.selectAll('g').attr('transform',transform);
            }
            else{
                const translate = 'translate(' + (-box.x)*(width/box.width)  + ',' + (-box.y)*(height/box.height) + ')'
                const scale = 'scale(' + (width/box.width) + ',' + (height/box.height) + ')';
                const transform = translate + ' ' + scale;
                svg.selectAll('g').attr('transform',transform);
            }

        }
    },[svg,props.lnSvgPaths,props.data,props.featureQue,props.simulation,props.modelOutput,props.fixedDecisions,props.state]);

    //so I need to work some stuff out with the actual model and how I encode stuff but this kinda works for now
    //doesn't let you have contralateral invovlement without main invovlement
    //also todo: make this a cue update instead of directly updating features
    useEffect(()=>{
        if(Utils.allValid([svg,props.patientFeatures])){
            let selection = svg.selectAll('.lnOutline')
            if(!selection.empty()){
                selection
                .on('dblclick',(e,d)=>{
                    if(d.name === 'outline'){ return; }
                    let val = d.queVal === -1? d.value: d.queVal;
                    let newVal = val < 1? 1: 0;
                    let pFeatures = Object.assign({},props.featureQue);
                    pFeatures[d.name] = newVal;
                    props.setFeatureQue(pFeatures)
                })
            }
        }
    },[svg,props.isMainPatient,props.patientFeatures,props.featureQue])

    return (
        <div
            className={"d3-component"}
            style={{'height':'99%','width':'99%'}}
            ref={d3Container}
        ></div>
    );
}