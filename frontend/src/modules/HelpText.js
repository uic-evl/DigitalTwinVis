import React, { useRef, useEffect, useState } from 'react';
import '../App.css';
import * as d3 from 'd3';
import Utils from './Utils.js';
import * as constants from './Constants.js';

export default function HelpText({height,width,text}){
    const d3Container = useRef(null);

    let [hgt,setH] = useState(0);
    let [wth,setW] = useState(0);
    const minR = 20;

    useEffect(function makeSvg(){
        if(d3Container.current){
            
            d3.select(d3Container.current).selectAll('svg').remove();
            let h = (height !== undefined)? height : d3Container.current.clientHeight;
            h = Math.max(minR,h);
            let w = width !== undefined? width : d3Container.current.clientWidth;
            w = Math.max(minR,w,h/1.5)
            var canvas = d3.select(d3Container.current)
                .append('svg')
                .attr('class','frameEntryD3')
                .attr('width',w)
                .attr('height',h)
                .style('margin','auto').style('display','block')

            var circle = canvas.append('rect')
                .attr('x',1)
                .attr('y',1)
                .attr('width',w-2)
                .attr('height',h-2)
                .attr('fill','none')
                .attr('strokeWidth',2)
                .attr('stroke','black')
                .attr('rx',20);

            var q = canvas.append('text')
                .attr('x',w/2)
                .attr('y',h/1.9)
                .attr('text-anchor','middle')
                .attr('dominant-baseline','middle')
                .attr('font-size',Math.min(w,h)*.8)
                .attr('cursor','default')
                .text('?');

            if(d3.select('body').select('.tooltip').empty()){
                d3.select('body').append('div')
                    .attr('class','tooltip')
                    .style('visibility','hidden');
            }
            var tip = d3.select('body').select('.tooltip');
            canvas.on('mouseover', function(e){
                tip.html(text);
                Utils.moveTTipEvent(tip,e);
            }).on('mousemove', function(e){
                Utils.moveTTipEvent(tip,e);
            }).on('mouseout', function(e){
                tip.html('')
                Utils.hideTTip(tip);
                // tip.node().setAttribute('background','');
            });

            setH(h);
            setW(w);
        }
    },[d3Container.current]);

    return (
        <div
            className="helpText"
            style={{'display':'inline-block','height':'90%','width':wth,'textAlign':'center','marginTop':'5%!important'}}
            ref={d3Container}
        ></div>
    );
}
