import React, { useEffect, useState, useLayoutEffect } from 'react';
import * as d3 from 'd3';

export default function useSVGCanvas(d3Container,name){
    //takes a ref to a container, makes an svg over it, and returns the svg selection, size ,and a tooltip
    const [windowHeight, windowWidth] = useWindowSize();
    const [height, setHeight] = useState(0);
    const [width, setWidth] = useState(0);
    const [svg, setSvg] = useState();
    const [tTip, setTTip] = useState();

    const [cWidth,setCWidth] = useState(0);
    const [cHeight,setCHeight] = useState(0);
    
    //I'm trying to get this to listen to container resize but idk if its working
    const cw = d3Container.current? d3Container.current.clientWidth: 0;
    const ch = d3Container.current? d3Container.current.clientHeight: 0;

    useEffect(()=>{
        if(d3Container.current){
            setCWidth(d3Container.current.clientWidth);
            setCHeight(d3Container.current.clientHeight);
        }
    },[cw,ch]);

    useEffect(function makeSvg(){
        if(d3Container.current){
            d3.select(d3Container.current).selectAll('svg').remove();

            var h = d3Container.current.clientHeight;
            var w = d3Container.current.clientWidth;

            var canvas = d3.select(d3Container.current)
                .append('svg')
                .attr('class','frameEntryD3')
                .attr('width',w)
                .attr('height',h);

            if(d3.select('body').select('.tooltip').empty()){
                d3.select('body').append('div')
                    .attr('class','tooltip')
                    .style('visibility','hidden');
            }
            var tip = d3.select('body').select('.tooltip');

            setHeight(h);
            setWidth(w);
            setSvg(canvas);
            setTTip(tip);
        }
    },[cHeight,cWidth,windowWidth, windowHeight,d3Container.current]);

    return [svg, height, width, tTip]
}

function useWindowSize() {
    const [size, setSize] = useState([0, 0]);
    useLayoutEffect(() => {
      function updateSize() {
        setSize([window.innerWidth, window.innerHeight]);
      }
      window.addEventListener('resize', updateSize);
      updateSize();
      return () => window.removeEventListener('resize', updateSize);
    }, []);
    return size;
  }