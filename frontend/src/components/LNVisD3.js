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

    useEffect(()=>{
        if(Utils.allValid([svg,props.lnSvgPaths,props.data])){
            let pathData = [];
            const data = props.data;
            for(const [name,path] of Object.entries(props.lnSvgPaths)){
                let idx = name.replace('_contra','').replace('_ipsi','');
                let val = data[idx];
                if(val === undefined){
                    val = -1
                } else if(name.includes('contra')){
                    val = Math.max(val - 1,0);
                } else{
                    val = Math.min(val,1);
                }
                let entry = {
                    'name': name,
                    'path': path,
                    'value': val,
                    'key': idx,
                    'isContra': name.includes('contra'),
                }
                pathData.push(entry)
            }
            console.log('ln vis', props.data)
            svg.selectAll('.lnOutline').remove();
            svg.selectAll('.lnGroup').remove();

            const getColor = d => {
                if(d.name === 'outline'){ return 'none';}
                return colorScale(d.value*.8);
            }
            console.log('pat data',pathData)
            let outlineGroup = svg.append('g').attr('class','lnGroup');
            outlineGroup.selectAll('.lnOutline')
                .data(pathData).enter()
                .append('path').attr('class','lnOutline')
                .attr('d',d=>d.path)
                .attr('stroke','black')
                .attr('opacity',1)
                .attr('fill',getColor);

            let box = svg.node().getBBox();
            let translate = 'translate(' + (-box.x)*(width/box.width)  + ',' + (-box.y)*(height/box.height) + ')'
            let scale = 'scale(' + (width/box.width) + ',' + (height/box.height) + ')';
            let transform = translate + ' ' + scale
            svg.selectAll('g').attr('transform',transform);

        }
    },[svg,props.lnSvgPaths,props.data]);

    //so I need to work some stuff out with the actual model and how I encode stuff but this kinda works for now
    //doesn't let you have contralateral invovlement without main invovlement
    useEffect(()=>{
        if(Utils.allValid([svg,props.patientFeatures])){
            let selection = svg.selectAll('.lnOutline')
            if(!selection.empty()){
                selection.on('dblclick',(e,d)=>{
                    if(d.name === 'outline'){ return; }
                    let val;
                    if(d.isContra){
                        val = d.value > 0? 1: 2;
                    } else{
                        val = d.value > 0? 0: 1;
                    }
                    let pFeatures = Object.assign({},props.patientFeatures);
                    pFeatures[d.key] = val;
                    props.setPatientFeatures(pFeatures)
                })
            }
        }
    },[svg,props.isMainPatient,props.patientFeatures])

    return (
        <div
            className={"d3-component"}
            style={{'height':'99%','width':'99%'}}
            ref={d3Container}
        ></div>
    );
}