import React, {useState, useEffect, useRef,useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";

export default function ModelLegend(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    
    const xMargin = 10
    const topMargin = 10;
    const bottomMargin = 5
    const spacing = 10;


    const getGroupName= (mName,treated)=>{
        let string = 'Treatment (' + mName + ')';
        if(!treated){
            string = 'No ' + string;
        }
        return string;
    }

    useEffect(()=>{
        if(svg === undefined){return}
        var decisionName = constants.DECISIONS_SHORT[props.state];
        var outcomesToShow = props.outcomesToShow? props.outcomesToShow: ['Treatment (predicted)','No Treatment (predicted)'];
        var legendData = [];
        let lBarHeight = (height - topMargin - bottomMargin - spacing)/2;
        var tNames = new Set([]);
        for(let model of ['predicted','neighbors']){
            for(let treated of [true,false]){
                let tName = getGroupName(model,treated);
                let selector = model+treated;
                tNames.add(selector)
                let isActive = outcomesToShow.indexOf(tName) >= 0;

                let color = treated? constants.dnnColor: constants.dnnColorNo;
                let xPos = model === 'predicted'? xMargin: width/2;
                let yPos = treated? topMargin: topMargin + lBarHeight + spacing;
                if( model === 'neighbors'){
                    color = treated? constants.knnColor: constants.knnColorNo;
                }
                
                let mText = model === 'predicted'? 'DL Model': 'Sim. Patients';
                if(width < 430){ mText = mText.replace(' Patients','').replace(' Model','')}
                let text = (treated? '': 'No ') + decisionName + ' (' + mText + ')';
                let strokeWidth = 2;//treated? 0: 1;
                let entry = {
                    'fill': color,
                    'text': text,
                    'y': yPos,
                    'x': xPos,
                    'strokeWidth': strokeWidth,
                    'name': tName,
                    'selector': selector,
                    'active': isActive,
                }
                legendData.push(entry);
            }
        }

        function clickToggle(d){
            const name = d.name;
            var newOutcomesToShow = props.outcomesToShow? [...props.outcomesToShow]: [];
            if(newOutcomesToShow.indexOf(name) >= 0){
                newOutcomesToShow =newOutcomesToShow.filter(d=>d !== name);
            } else{
                newOutcomesToShow.push(name);
            }
            props.setOutcomesToShow(newOutcomesToShow);
        };

        svg.selectAll('.legend').remove();
        svg.selectAll('text').remove();

        svg.selectAll('.outline').remove();
        const outlinemargin = spacing/3;
        const outlines = svg.selectAll('.outline')
            .data(legendData);
        outlines.enter()
            .append('rect').attr('class','outline')
            .attr('x',d=>d.x - outlinemargin)
            .attr('y',d=>d.y-outlinemargin)
            .attr('width',width/2 - 2*xMargin)
            .attr('height',lBarHeight + 2*outlinemargin)
            .attr('fill','white')
            .attr('fill-opacit',0)
            .attr('stroke','black')
            .attr('stroke-width',d=>d.active? 2:1)
            .attr('cursor','pointer')
            .attr('rx',outlinemargin).attr('ry',outlinemargin)
            .on('click',(e,d)=>clickToggle(d));
        
        svg.selectAll('.legend')
            .data(legendData).enter()
            .append('rect').attr('class',d=> 'legend ' + d.selector)
            .attr('x',d=>d.x)
            .attr('y',d=>d.y)
            .attr('width',lBarHeight)
            .attr('height',lBarHeight)
            .attr('fill',d=>d.fill)
            .attr('fill-opacity',d=>d.active? 1:0)
            .attr('stroke','black')
            .attr('cursor','pointer')
            .attr('stroke-width',d=>d.strokeWidth)
            .on('click',(e,d)=>clickToggle(d));
            
        svg.selectAll('.lText').data(legendData)
            .enter()
            .append('text')
            .attr('class',d => 'lText ' + d.selector)
            .attr('x', d=> d.x + lBarHeight + 3)
            .attr('y',d=>d.y+(lBarHeight/2))
            .attr('text-align','center')
            .attr('cursor','pointer')
            .attr('font-weight','bold')
            .attr('dominant-baseline','middle')
            .attr('fill',d=>d.active? 'black':'grey')
            .attr('font-size',lBarHeight-3)
            .text(d=>d.text)
            .on('click',(e,d)=>clickToggle(d));


    },[svg,height,width,props.outcomesToShow])

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%','overflowY':'scroll'}}
            ref={d3Container}
        ></div>
    );
}