import React, {useState, useEffect, useRef,useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";



export default function AttributionLegend(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    
    const margin = 20;
    const topMargin = Math.max(height/4,36);
    const bottomMargin = Math.max(height/4,36);

    function getSimulationKey(){
        if(!Utils.allValid([props.simulation,props.modelOutput,props.fixedDecisions])){return undefined}
        let key = props.modelOutput;
        for(let i in props.fixedDecisions){
          let d = props.fixedDecisions[i];
          let di = parseInt(i) + 1
          if(d >= 0){
            let suffix = '_decision'+(di)+'-'+d;
            key += suffix;
          }
        }
        return key
    }
    function formatText(v){
        let t = (v.value*100).toFixed(0) + '%';
        if(v.value > 0){
            t = '+' + t;
        }
        return t;
    }

    useMemo(()=>{
        if(svg !== undefined & props.simulation !== undefined){
            var simKey = getSimulationKey();
            var res = props.simulation[simKey]['decision'+(props.currState+1)+'_attention'];
            //for the case of a fixed decision on the current attribution view
            if(res === undefined | res === 0){
                simKey = props.modelOutput;
                res = props.simulation[props.modelOutput]['decision'+(props.currState+1)+'_attention'];
            }
            const colorScale = Utils.getColorScale('attributions',res.range[0],res.range[1]);
            
            const increments = [.01,.25,.5,.75,.99];
            const barWidth = (width - 2*margin)/increments.length;
            const barHeight = height - topMargin - bottomMargin;

            var currX = margin;
            var lData = [];
            for(let i of increments){
                let cVal = (res.range[0]*(1-i)) + (i)*res.range[1];
                lData.push({
                    'x': currX,
                    'color': colorScale(cVal),
                    'value': cVal,
                });
                currX += barWidth;
            }

            const lRects = svg.selectAll('.legendRect').data(lData,d=>d.x);
            lRects.enter()
                .append('rect').attr('class','legendRect')
                .merge(lRects)
                .attr('x',d=>d.x)
                .attr('y',topMargin)
                .attr('height',barHeight)
                .attr('width',barWidth-2)
                .transition(10000)
                .attr('fill',d=>d.color);

            lRects.exit().remove();

            const labelSize = Math.min(bottomMargin*.5,16);
            const lLabels = svg.selectAll('.lLabel').data(lData,d=>d.x);
            
            lLabels.enter()
                .append('text').attr('class','lLabel')
                .merge(lLabels)
                .attr('x',d=>d.x+(barWidth/2))
                .attr('y',height - bottomMargin + labelSize)
                .attr('text-anchor','middle')
                .attr('font-size',labelSize)
                .text(formatText);

            const title = svg.select('.legendTitle')
            if(title.empty()){
                svg.append('text').attr('class','legendTitle')
                .attr('x',width/2)
                .attr('y',topMargin*.8)
                .attr('text-anchor','middle')
                .text('Impact on Decision')
                .attr('font-weight','bold')
                .attr('font-size',Math.min(topMargin*.9,18));
            }
        }
    },[svg,props.simulation,props.modelOutput,props.currState,width,height,props.fixedDecisions]);

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}