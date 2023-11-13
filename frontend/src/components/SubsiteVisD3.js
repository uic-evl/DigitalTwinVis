import React, {useState, useEffect, useRef} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";


export default function SubsiteVisD3(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    
    const keepAspectRatio=true;
    const useAttention = props.useAttention? props.useAttention : true;
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

            var getColor = d3.interpolateGreys;
            var  getFill = (d) => {
                if(d.name === 'outline'){
                    return 'none'
                }
                if(!d.usable){
                    return 'none'
                }
                return getColor(d.plotValue);
            }
            //if we do attention we use the attention color scale instead of black/white, and white for empty values
            var getAttribution = d => 0;
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
                        const colorScale = Utils.getColorScale('attributions',attributions.range[0],attributions.range[1]);
                        getAttribution = key => attributions.baseline['subsite_'+key];
                        getFill = d => {
                            if(d.name === 'outline'){
                                return 'none'
                            }
                            if(!d.usable){
                                return 'none'
                            } 
                            let cval = getAttribution(d.key);
                            //if zero, use white. If a value that isn't in the model (pharyngeal wall), use 0 attribution color
                            if(cval === 0 | cval === undefined){
                                return d.value >= 1? colorScale(0): 'white';
                            }
                            return colorScale(cval);
                        }
                    }
                }
            }
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
                    'attribution': getAttribution(key),
                    'usable': constants.validSubsites.indexOf(key) > -1
                }
                pathData.push(entry)
            }
            

            function getStroke(d){
                return d.usable? d.queVal > .5? 1:.5: d.name === 'outline'? .4:.1;
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
                    if(!d.usable | d.plotValue === undefined){ return }
                    let string = d.name + ' ' + Boolean(d.plotValue);
                    if(useAttention){
                        let att = d.attribution === undefined? 0: d.attribution;
                        string += '</br> Attribution: ' + (100*att).toFixed(2) + '%';
                    }
                    
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

            //scale but keep aspect ratio to fit box
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
    },[svg,props.subsiteSvgPaths,props.data,props.simulation,props.featureQue]);

    return (
        <div
            className={"d3-component"}
            style={{'height':'99%','width':'99%'}}
            ref={d3Container}
        ></div>
    );
}