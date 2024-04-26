import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'
import { interpolate } from 'd3';

export default function SymptomPCPD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);

    const margin = 30;
    const symptoms = ['drymouth','voice','teeth','taste','nausea','choke','vomit','pain','mucus','mucositis']
    const plotAxes = [
        'pca1','pca2','pca2',
        // 'hpv','ic','nstage','tstage',
        'drymouth','voice','taste',
    ]


    const categoricalColors = d3.scaleOrdinal()
        .domain([0,7])
        .range(['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f','#ff7f00']);

    const lineFunc = d3.line()
        .x(d => d[0])
        .y(d => d[1]);

    function clipUnit(v){
        if(v < 0){
            return 0;
        } else if(v > 1){
            return 1
        }
        return parseFloat(v);
    }

    function getCoordinates(axName, yval){
        let xval = plotAxes.indexOf(axName)/plotAxes.length;
        let x = clipUnit(xval) * (width - margin) + margin;
        let y = height - (clipUnit(yval)*(height-margin)) - margin;
        return [x,y];
    }

    useEffect(function draw(){
        if(svg !== undefined & props.doseData != undefined & props.clusterData !== undefined){

            let max_pca = [0,0,0]
            for(let i in props.doseData[0].dose_pca){
                while(i > max_pca.length){
                    max_pca.push(0)
                }
                let dvals = props.doseData.map(d=>d.dose_pca[i])
                let dMax = Math.max(...dvals);
                max_pca[i] = dMax;
            }

            function formatData(d){
                let newD = Object.assign(d,{})
            
                newD.pca1 = d.dose_pca[0]/max_pca[0];
                newD.pca2 = d.dose_pca[1]/max_pca[1];
                newD.pca3 = d.dose_pca[2]/max_pca[2];
            
                let valMap = {
                    't1': 1/4,
                    't2': 2/4,
                    't3': 3/4,
                    't4': 4/4,
                    'n2a': 1/2,
                    'n2b': 1/2,
                    'n2c': 2/2,
                    'n3': 2/2,
                }
                function fromMap(v){
                    let val = valMap[v];
                    if(val === undefined){ val = 0; }
                    return val
                }
                newD.tstage = fromMap(d.t_stage);
                newD.nstage = fromMap(d.n_stage);
        
                let dateSliceStart = d.dates.indexOf(13);
                let dateSliceStop = d.dates.indexOf(33)
                for(let sympt of symptoms){
                    let svals = d['symptoms_'+sympt].slice(dateSliceStart,dateSliceStop+1)
                    newD[sympt] = Math.max(...svals)/10;
                }
                return newD;
            }


            var data = props.clusterData.map((clusterEntry,i)=>{
                let d = Object.assign(clusterEntry,{})
                let datapoints = []
                for(let id of d.ids){
                    let dpoint = props.doseData.filter(d=>d.id == id)[0];
                    if(dpoint !== undefined){
                        dpoint.cluster = d.clusterId;
                        dpoint.active = (d.clusterId === props.activeCluster);
                        dpoint = formatData(dpoint);
                        let pathPoints = [];
                        for(let pVar of plotAxes){
                            let yval = dpoint[pVar];
                            let [x,y] = getCoordinates(pVar,yval)
                            pathPoints.push([x,y])
                        }
                        dpoint.path = lineFunc(pathPoints);
                        dpoint.color = categoricalColors(d.clusterId);
                        datapoints.push(dpoint);
                    }
                }
                return datapoints
            });
            let pathData = [];
            for(let dlist of data){
                for(let dpoint of dlist){
                    pathData.push(dpoint)
                }
            }

            svg.selectAll('g').filter('.pcpCurveGroup').remove();
            var curveGroup = svg.append('g').attr('class','pcpCurveGroup');
            curveGroup.selectAll('path').filter('.pcpCurve')
                .data(pathData).enter()
                .append('path').attr('class','pcpCurve')
                .attr('d',d=>d.path)
                .attr('stroke',d=>d.color)
                .attr('stroke-width',d=> d.active? 3:2)
                .attr('stroke-opacity',d=> d.active? 1:.2)
                .attr('fill-opacity',0)
        }
    },[props.clusterData,props.doseData,svg,props.activeCluster])

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}