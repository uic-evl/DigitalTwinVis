import React, {useState, useEffect, useRef} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";


export default function DLTisD3(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);

    const dltorder = ['other','gastrointestinal',
    'hematological','pneumonia','neurological',
    'vascular','dermatological','nephrological']


    useEffect(()=>{
        if(Utils.allValid([svg,props.dltSvgPaths,props.data])){
            let pathData = [];
            const data = props.data;
            const state = props.currState === undefined? 0: props.currState;
            const isMainPatient = data['dlt1'] !== undefined;//patient format or simulaiton

            function getDlt(name){
                if(state == 0){
                    return 0;
                }
                if(isMainPatient){
                    let pos = dltorder.indexOf(name);
                    if(pos < 0){
                        console.log('bad spell',name);
                        return 0;
                    }
                    let val = data['dlt'+state][pos];
                    return val === undefined? 0: val;
                }else{
                    let key = name === 'pneumonia'? 'Infection (Pneumonia)': Utils.capitalize(name);
                    key = 'DLT_' + key;
                    if(state > 1){
                        key += ' 2';
                    }
                    let val = data[key];
                    if(val === undefined){
                        console.log('bad patient key',key,data);
                        val = 0
                    }
                    return val
                }
            }

            for(const [name,entry] of Object.entries(props.dltSvgPaths)){
                let val = getDlt(name);
                let objEntry = {
                    'path': entry.d,
                    'name': name,
                    'val': val,
                    'style': entry.style,
                }
                pathData.push(objEntry);
            }
            svg.selectAll('.dltOutline').remove();
            svg.selectAll('.dltGroup').remove();

            let outlineGroup = svg.append('g').attr('class','dltGroup');
            outlineGroup.selectAll('.dltOutline')
                .data(pathData).enter()
                .append('path').attr('class',d=> d.val > .0001? 'dltOutline dltActive':'dltOutline')
                .attr('d',d=>d.path)
                .attr('opacity',d=>d.val**.25)
                .attr('style',d=>d.style)
                
            svg.selectAll('.dltActive').on('mouseover',function(e,d){
                    let string = d.name + ': ' + (100*d.val).toFixed(0) + '%';
                    tTip.html(string);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    tTip.html('')
                    Utils.hideTTip(tTip);
                });;;

            let box = svg.node().getBBox();
            let translate = 'translate(' + (-box.x)*(width/box.width)  + ',' + (-box.y)*(height/box.height) + ')'
            let scale = 'scale(' + (width/box.width) + ',' + (height/box.height) + ')';
            let transform = translate + ' ' + scale
            svg.selectAll('g').attr('transform',transform);

        }
    },[svg,props.dltSvgPaths,props.data,props.currState]);

    return (
        <div
            className={"d3-component"}
            style={{'height':'99%','width':'99%'}}
            ref={d3Container}
        ></div>
    );
}