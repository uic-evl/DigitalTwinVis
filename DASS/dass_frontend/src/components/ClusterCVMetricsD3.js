import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
// import Utils from '../modules/Utils.js'

export default function ClusterCVMetricsD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [data,setData] = useState();
    const [dataDiffs,setDataDiffs] = useState();
    const [clusterOrder,setClusterOrder] = useState();
    const [thresholdOrder, setThresholdOrder] = useState();
    const [extents,setExtents] = useState([0,0])
    const yMarginTop = 20;
    const yMarginBottom = 20;
    const xMargin = 10;
    const barSpacing = 2;
    
    function formatCName(name){
        if(name === 'baseline'){
            return 'base';
        } if(name === 'all'){
            return 'all'
        }
        return name.replace('post_cluster_','');
    }
    useEffect(function formatData(){
        if(svg !== undefined & props.clusterMetricData !== undefined){
            const mData = props.clusterMetricData;
            

            const clusters = Array.from(new Set(mData.map(d=>d.cluster)));
            clusters.sort();
            const thresholds = Array.from(new Set(mData.map(d=>d.threshold)));
            thresholds.sort();
            const getMetric = d=>(d[props.metric]=== undefined)? 0: d[props.metric];
            const getMetricChange = d=>(d[props.metric+'_change'] === undefined)? 0: d[props.metric+'_change'];
            let data = [];
            let diffs = [];
            let maxVal = 0;
            let minVal = 0;
            for(let tHold of thresholds){
                let tData = mData.filter(d=>d.threshold === tHold);
                if(tData === undefined | tData.length ===  0){ continue; }
                const baseline = getMetric(tData[0]) - getMetricChange(tData[0]);
                let entry = [baseline];
                let dEntry = [0];
                for(let c of clusters){
                    let cData = tData.filter(d=>d.cluster === c);
                    if(cData.length <= 0){ continue; }
                    let cValue = getMetric(cData[0]);
                    let diffValue = getMetricChange(cData[0]);
                    entry.push(cValue);
                    dEntry.push(diffValue);
                }
                maxVal = Math.max(maxVal,...entry);
                minVal = Math.min(minVal,...entry);
                data.push(entry);
                diffs.push(dEntry);
            }
            
            setData(data);
            setDataDiffs(diffs);
            setClusterOrder(['baseline'].concat(clusters));
            setThresholdOrder(thresholds);
            setExtents([minVal,maxVal]);
        }
    },[svg,props.clusterMetricData,props.metric])

    useEffect(function draw(){
        if(data === undefined | dataDiffs === undefined | svg === undefined){ return; }
        const [minVal,maxVal] = extents;
        var xCenter = height - yMarginBottom;
        if(minVal < 0){
            let ratio = maxVal/(maxVal + Math.abs(minVal));
            let topSize = (height - yMarginBottom -yMarginTop)*ratio;
            xCenter = yMarginTop + topSize;
        }
        const heightScale = d3.scaleLinear()
            .domain([0,maxVal])
            .range([0,xCenter-yMarginTop]);

        const getHeight = d => heightScale(Math.abs(d));
        const getY = d=>{
            if(d >= 0){
                return xCenter- getHeight(d);
            } else{
                return xCenter;
            }
        }

        function getColor(d){
            let stub = d.replace('post_cluster_','')
            let cluster = parseInt(stub);
            if(!isNaN(cluster)){
                return props.categoricalColors(cluster);
            } if(d.includes('all')){
                return 'pink';
            } 
            return 'grey';
        }

        const subChartWidth = ((width - 2*xMargin)/thresholdOrder.length) - 2*barSpacing
        const barWidth = (subChartWidth/clusterOrder.length) - barSpacing;

        const getX = (thresh, name) => {
            let tIdx = thresholdOrder.indexOf(thresh);
            let cIdx = clusterOrder.indexOf(name);
            let chartStart = xMargin + (subChartWidth+2*barSpacing)*tIdx;
            let barStart = cIdx*(barWidth + barSpacing) + barWidth/2;
            return chartStart + barStart; 
        }
        let barPoints = [];
        let chartTitles = [];
        for(let ti in thresholdOrder){
            let dEntry = data[ti];
            let thold = thresholdOrder[ti];
            let titleEntry = {
                'threshold': thold,
                'x': getX(thold,'baseline') + subChartWidth/2,
            }
            chartTitles.push(titleEntry);
            for(let ci in clusterOrder){
                let cEntry = dEntry[ci];
                let cName= clusterOrder[ci];
                let entry = {
                    'value': cEntry,
                    'valueDiff': dataDiffs[ti][ci],
                    'cluster': cName,
                    'threshold': thold,
                    'x': getX(thold,cName),
                    'y': getY(cEntry),
                    'height': getHeight(cEntry),
                    'color': getColor(cName),
                }
                barPoints.push(entry)
            }
        }

        svg.selectAll('.clusterRect').remove()
        svg.selectAll('rect').filter('.clusterRect')
            .data(barPoints).enter()
            .append('rect').attr('class','clusterRect')
            .attr('x',d=>d.x)
            .attr('y',d=>d.y)
            .attr('height',d=>d.height)
            .attr('width',barWidth)
            .attr('fill',d=>d.color);

        const textSize = Math.max(50,barWidth/2);
        svg.selectAll('.valueText').remove();
        svg.selectAll('text').filter('.valueText')
            .data(barPoints).enter()
            .append('text').attr('class','valueText')
            .attr('text-anchor','middle')
            .attr('x',d=>d.x+barWidth/2)
            .attr('y',d=>Math.min(d.y+textSize,xCenter-textSize))
            .attr('font-size',textSize)
            .html(d=>d.value.toFixed(2));

        svg.selectAll('.xlabel').remove()
        svg.selectAll('text').filter('.xlabel')
            .data(barPoints).enter()
            .append('text').attr('class','xlabel')
            .attr('text-anchor','middle')
            .attr('x',d=>d.x+barWidth/2)
            .attr('y',height-textSize)
            .attr('font-size',textSize)
            .html(d=>formatCName(d.cluster));

        const symptom = props.clusterMetricData[0].symptom.substring(0,5);
        svg.selectAll('.chartTitle').remove()
        svg.selectAll('text').filter('.chartTitle')
            .data(chartTitles).enter()
            .append('text').attr('class','chartTitle')
            .attr('text-anchor','middle')
            .attr('x',d=>d.x)
            .attr('y',textSize)
            .attr('font-size',2+textSize)
            .html(d=> props.metric + ' (' + symptom + '>'+d.threshold+")");
        
        
    },[svg,data,dataDiffs])

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}
