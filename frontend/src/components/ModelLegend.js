import React, {useState, useEffect, useRef,useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";

export default function ModelLegend(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    
    const xMargin = 10
    const topMargin = 20;
    const bottomMargin = 5
    const spacing = 3;


    useEffect(()=>{
        if(svg === undefined){return}
        var decisionName = constants.DECISIONS_SHORT[props.state];
        var legendData = [];
        let lBarHeight = (height - topMargin - bottomMargin - spacing)/2;
        for(let model of ['model','neighbors']){
            for(let treated of [true,false]){
                let color = treated? constants.dnnColor: constants.dnnColorNo;
                let xPos = model === 'model'? xMargin: width/2;
                let yPos = treated? topMargin: topMargin + lBarHeight + spacing;
                if( model === 'neighbors'){
                    color = treated? constants.knnColor: constants.knnColorNo;
                }
                let text = decisionName + ' (' + model + ' pred.)';
                text = treated? text: 'No '+text;
                let strokeWidth = treated? 0: 1;
                let entry = {
                    'fill': color,
                    'text': text,
                    'y': yPos,
                    'x': xPos,
                    'strokeWidth': strokeWidth,
                }
                legendData.push(entry);
            }
        }

        svg.selectAll(".legend").remove();
        svg.selectAll('legendText').remove();
        svg.selectAll('.legend')
            .data(legendData).enter()
            .append('rect').attr('class','legend')
            .attr('x',d=>d.x)
            .attr('y',d=>d.y)
            .attr('width',lBarHeight)
            .attr('height',lBarHeight)
            .attr('fill',d=>d.fill)
            .attr('stroke','black')
            .attr('stroke-width',d=>d.strokeWidth)
            
        svg.selectAll('.lText').data(legendData)
            .enter()
            .append('text')
            .attr('class','lText')
            .attr('x', d=> d.x + lBarHeight + 3)
            .attr('y',d=>d.y+(lBarHeight/2))
            .attr('text-align','center')
            .attr('font-weight','bold')
            .attr('dominant-baseline','middle')
            .attr('font-size',lBarHeight-spacing)
            .text(d=>d.text);

    },[svg,height,width])

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%','overflowY':'scroll'}}
            ref={d3Container}
        ></div>
    );
}