import React, { useRef, useEffect, useState } from 'react';
import '../App.css';
import * as d3 from 'd3';
import Utils from './Utils.js';
import * as constants from './Constants.js';
import { propTypes } from 'react-bootstrap/esm/Image';

export default function HelpButton({height,width,image,imageHeight,imageWidth}){
    const d3Container = useRef(null);

    let [hgt,setH] = useState(0);
    let [wth,setW] = useState(0);
    const minR = 10;

    useEffect(function makeSvg(){
        if(d3Container.current){
            
            d3.select(d3Container.current).selectAll('svg').remove();
            let h = (height !== undefined)? height : d3Container.current.clientHeight;
            h = Math.max(minR,h);
            let w = width? width : h;
            w = Math.max(minR,w)
            var canvas = d3.select(d3Container.current)
                .append('svg')
                .attr('class','frameEntryD3')
                .attr('width',w)
                .attr('height',h);

            var circle = canvas.append('circle')
                .attr('cx',w/2)
                .attr('cy',h/2)
                .attr('r',Math.min(w/2,h/2))
                .attr('fill','grey')

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

            if(image){
                canvas.on('mouseover', function(e){
                    Utils.ttipShowImage(tip, image,imageHeight,imageWidth);
                }).on('mousemove', function(e){
                    Utils.moveTTip(tip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tip);
                    // tip.node().setAttribute('background','');
                });
            }

            setH(h);
            setW(w);
        }
    },[d3Container.current]);

    return (
        <div
            className="helpButton"
            style={{'display':'inline-block','height':hgt,'top':hgt/2,'width':wth}}
            ref={d3Container}
        ></div>
    );
}
