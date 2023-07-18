import React, {useState, useEffect, useRef} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";


export default function LNVisD3(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);

    const colorScale = d3.scaleLinear()
        .domain([-1,0,1])
        .range(['#bdbdbd','white','#dd1c77']);

    const getColor = d => {
        if(d.name === 'outline'){ return 'none';}
        if(d.queVal > -1){
            return colorScale(d.queVal);
        }
        return colorScale(d.value);
    }

    const getStrokeWidth = (d)=>{
        if(d.name === 'outline'){ return 3;}
        //nochange or que is empt for this node
        if(d.value === d.queVal | d.queVal < 0){ return .1; }
        return 2;
    }

    useEffect(()=>{
        if(Utils.allValid([svg,props.lnSvgPaths,props.data])){
            let pathData = [];
            const data = props.data;
            for(const [name,path] of Object.entries(props.lnSvgPaths)){
                let val = data[name];
                let queVal = props.featureQue === undefined? -1:props.featureQue[name];
                queVal = queVal === undefined? -1: queVal;
                val = val === undefined? -1: val;
                let entry = {
                    'name': name,
                    'path': path,
                    'value': val,
                    'queVal': queVal,
                    'isContra': name.includes('contra'),
                }
                pathData.push(entry)
            }
            svg.selectAll('.lnOutline').remove();
            svg.selectAll('.lnGroup').remove();

            console.log(props.featureQue)
            let outlineGroup = svg.append('g').attr('class','lnGroup');
            outlineGroup.selectAll('.lnOutline')
                .data(pathData).enter()
                .append('path').attr('class','lnOutline')
                .attr('d',d=>d.path)
                .attr('stroke','black')
                .attr('opacity',1)
                .attr('stroke-width',getStrokeWidth)
                .attr('fill',getColor);

            let box = svg.node().getBBox();
            let translate = 'translate(' + (-box.x)*(width/box.width)  + ',' + (-box.y)*(height/box.height) + ')'
            let scale = 'scale(' + (width/box.width) + ',' + (height/box.height) + ')';
            let transform = translate + ' ' + scale
            svg.selectAll('g').attr('transform',transform);

        }
    },[svg,props.lnSvgPaths,props.data,props.featureQue]);

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