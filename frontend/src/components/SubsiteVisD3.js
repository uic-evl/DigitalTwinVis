import React, {useState, useEffect, useRef} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";


export default function SubsiteVisD3(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    
   //GPS BOT NOS Soft palate Tonsil
    function getSubsiteKey(string){
        if(string.includes('Soft')){
            return 'Soft palate'
        } 
        return string;
    }


    // const toDraw = constants.validSubsites.concat(['outline']);
    useEffect(()=>{
        if(Utils.allValid([svg,props.subsiteSvgPaths,props.data])){
            let pathData = [];
            const data = props.data;
            for(const [name,path] of Object.entries(props.subsiteSvgPaths)){
                // if(toDraw.indexOf(name) < 0){
                //     continue;
                // }
                let key = getSubsiteKey(name);
                let val = data['subsite_'+key];
                val = val === undefined? -1: val;
                let queVal = props.featureQue['subsite_'+key];
                let plotVal = queVal; 
                if(queVal === undefined){
                    queVal = -1
                    plotVal = val;
                }
                let entry = {
                    'name': name,
                    'path': path,
                    'key': key,
                    'value': val,
                    'queVal': queVal,
                    'plotValue': plotVal,
                    'usable': constants.validSubsites.indexOf(key) > -1
                }
                pathData.push(entry)
            }

            const getColor = d3.interpolateGreys;
            function getFill(d){
                if(d.name === 'outline'){
                    return 'none'
                }
                if(!d.usable){
                    return 'none'
                }
                return getColor(d.plotValue);
            }

            function getStroke(d){
                return d.usable? 1: d.name === 'outline'? .4:.1;
            }

            svg.selectAll('.subsiteOutline').remove();
            svg.selectAll('.subsiteGroup').remove();

            let outlineGroup = svg.append('g').attr('class','subsiteGroup');
            outlineGroup.selectAll('.subsiteOutline')
                .data(pathData).enter()
                .append('path')
                .attr('class',d=> d.name === 'outline'? 'subsiteOutline': 'subsiteOutline usable')
                .attr('id',d=>'subsite'+d.name)
                .attr('d',d=>d.path)
                .attr('stroke','black')
                .attr('stroke-width',getStroke)
                .attr('opacity',1)
                .attr('fill',getFill)
                .attr('cursor',d=>d.usable? 'pointer':'')
                .on('mouseover',function(e,d){
                    let string = d.name + ' ' + d.plotValue.toFixed(2);
                    tTip.html(string);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });
            
            if(props.isSelectable){
                outlineGroup
                .selectAll('.subsiteOutline')
                .on('dblclick',(e,d)=>{
                    let val = d.queVal === -1? d.value: d.queVal;
                    let newVal = val < 1? 1: 0;
                    let pFeatures = Object.assign({},props.featureQue);
                    let exisitingSubsiteFeatures = Object.keys(data).filter(d=> d.includes('subsite'));
                    for(const f of exisitingSubsiteFeatures){
                        pFeatures[f] = 0;
                    }
                    const fname = d.usable? d.key: 'NOS';
                    pFeatures['subsite_'+fname] = newVal;
                    props.setFeatureQue(pFeatures);
                })
            }
            outlineGroup.selectAll('.usable').raise();


            let box = svg.node().getBBox();
            let translate = 'translate(' + (-box.x)*(width/box.width)  + ',' + (-box.y)*(height/box.height) + ')'
            let scale = 'scale(' + (width/box.width) + ',' + (height/box.height) + ')';
            let transform = translate + ' ' + scale
            svg.selectAll('g').attr('transform',transform);

        }
    },[svg,props.subsiteSvgPaths,props.data,props.simulation,props.featureQue]);

    return (
        <div
            className={"d3-component"}
            style={{'height':'99%','width':'99%'}}
            ref={d3Container}
        ></div>
    );
}