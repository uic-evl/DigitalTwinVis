import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'


export default function SymptomPlotD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [clusterData,setClusterData] = useState();
    const [patientData,setPatientData] = useState();
    //this lets me group timepoints by aggregating them in a single list
    //the code takes the maximum of the groups time points for each patient
    const treatmentDates = [
        [0,1],
        [2,3,4,5],
        [6,7],
        [13],
        [33],
    ];
    const symptomBins = [
        [0],
        [1,2],
        [3,4],
        [5,6,7],
        [8,9,10],
    ]

    // const symptomBins = [
    //     [0],
    //     [1,2,3,4],
    //     [5,6,7,8,9,10],
    // ]

    function getSymptomLevel(sVal){
        for(let i in symptomBins){
            i = parseInt(i);
            if(symptomBins[i].indexOf(parseInt(sVal)) > -1){
                return i;
            }
        }
        console.log('error getting syptom value',sVal);
        return 0;
    }

    const tTipFeatures = ['id','hpv','t_stage','n_stage','rt','ic','concurrent','subsite','totalDose'];

    const xMarginRight = 10;
    const xMarginLeft = 15;//bigger for x Axis
    const yMargin = 30;
    const legendFontSize = 14;
    const maxSymptomValue = 10;
    const barWidth = (width-xMarginLeft - xMarginRight)/(treatmentDates.length + 2);
    const barHeight = (height- 2*yMargin - legendFontSize - 10)/(symptomBins.length + 2);
    const maxR = Math.min(barWidth,barHeight)/3;
    const legendWidth = Math.max(70, width*.15);
    const showTransitions = false;
    const xScale = d3.scaleLinear()
        .domain([0, treatmentDates.length-1])
        .range([xMarginLeft + barWidth/2,width-xMarginRight-barWidth/2-legendWidth]);
    const yScale = d3.scaleLinear()
        .domain([0,getSymptomLevel(maxSymptomValue)])
        .range([height- legendFontSize - yMargin - maxR,yMargin]);
    const lineFunc = d3.line();

    function getMaxSymptom(pEntry,dateRange){
        let val = pEntry['symptoms_'+props.mainSymptom];
        if(val === undefined | pEntry.dates === undefined){
            console.log('cant get symptom values in symptom plot',pEntry,props.mainSymptom);
            return -1;
        }
        let values = dateRange.map(x => pEntry.dates.indexOf(x)).filter(x => x > -1).map(x => getSymptomLevel(val[x]));
        return Math.max(...values);
    }

    function symptomListToPoints(sVals){
        let points = [];
        for(let i in sVals){
            let x = xScale(i);
            let y= yScale(sVals[i]);
            points.push([x,y])
        }
        return points
    }

    function formatPatient(pEntry,clusterId){
        let sVals = treatmentDates.map(d => getMaxSymptom(pEntry,d));
        let points = symptomListToPoints(sVals);
        let entry = {
            'clusterId': clusterId,
            'symptoms': sVals,
            'points': points,
            'path': lineFunc(points),
        }
        for(let f of tTipFeatures){
            entry[f] = pEntry[f];
        }
        return entry
    }

    function getClusterMeans(formattedPatients){
        let sLists = formattedPatients.map(x => x.symptoms);
        let nSteps = sLists[0].length;
        let means = []
        for(let i = 0; i < nSteps; i++){
            let vals = sLists.map(x => x[i])
            let meanVal = arrayMean(vals);
            means.push(meanVal);
        }
        return means;
    }

    function formatCluster(formattedPatients,clusterEntry){
        let meanVals = getClusterMeans(formattedPatients);
        let points = symptomListToPoints(meanVals);
        let size = formattedPatients.length;
        let entry = {
            'symptoms': meanVals,
            'points': points,
            'path': lineFunc(points),
            'size': size,
            'clusterId': clusterEntry.clusterId
        }
        return entry;
    }

    useEffect(function format(){
        if(svg != undefined & props.doseData != undefined & props.clusterData !== undefined){
            let pLists = [];
            let clusterMeans = [];

            for(let cluster of props.clusterData){
                let patientIds = cluster.ids.map(x => parseInt(x));
                let patientData = props.doseData.filter( x => patientIds.indexOf(parseInt(x.id)) >= 0 )
                let formattedPatients = patientData.map(d => formatPatient(d,cluster.clusterId));
                for(let p of formattedPatients){
                    pLists.push(p);
                } 
                let clusterEntry = formatCluster(formattedPatients, cluster)
                clusterMeans.push(clusterEntry);
            }
            setPatientData(pLists);
            setClusterData(clusterMeans);
            
        }
    },[svg,props.clusterData,props.doseData,props.mainSymptom])

    useEffect(function drawLines(){
        if(svg !== undefined & patientData !== undefined & clusterData !== undefined){

            var isActive = d => (d.clusterId == props.activeCluster);
            const catLineColor = (d) => props.categoricalColors(parseInt(d.clusterId));
            function makeLines(data,className,oBase,wBase,showNotActive,brush){
                svg.selectAll('path').filter('.'+className).remove();
                var getOpacity = (d,base) => isActive(d)? base:(base/1)*showNotActive;
                var getThickness = (d,base) => isActive(d)? base:(base*.7)*showNotActive;
                let lines = svg.selectAll('path').filter('.'+className)
                    .data(data).enter()
                    .append('path')
                    .attr('class',className)
                    .attr('d',d=>d.path)
                    .attr('fill','none')
                    .attr('stroke', catLineColor)
                    .attr('stroke-opacity',d=>getOpacity(d,oBase))
                    .attr('stroke-width',d=>getThickness(d,wBase))
                    .style('cursor',brush? 'pointer':'auto');
                if(brush){
                    lines.on('dblclick', (e,d)=>{
                        if(d !== undefined){
                            if(!isActive(d) & d.clusterId !== undefined){
                                props.setActiveCluster(parseInt(d.clusterId));
                            }
                        }
                    }).on('mouseover',function(e,d){
                        if(d.size === undefined){ return; }
                        let tipText = 'Cluster: ' + d.clusterId 
                        + '</br>' + 'Size: ' + d.size + ' patients';
                        tTip.html(tipText);
                    }).on('mousemove', function(e,d){
                        if(d.size === undefined){ return; }
                        Utils.moveTTipEvent(tTip,e);
                    }).on('mouseout', function(e){
                        Utils.hideTTip(tTip);
                    });
                }
                
                return lines;
            }
            let activeClusterSize = patientData.filter(d=>isActive(d)).length;
            if(showTransitions){
                makeLines(patientData,'patientLine',1/(activeClusterSize**.75),3,false,false);
            }
            
            makeLines(clusterData,'clusterLine',.9,9,true,true);
        }
    },[svg,height,width,patientData,clusterData,props.activeCluster]);

    useEffect(function drawCircles(){
        if(svg !== undefined & patientData !== undefined & clusterData !== undefined){
            //makes a item s.t time[timepoint position map][syptomValue position map] = [#with-value in cluster 0, # with value in cluster 1 ....]
            let nActive = patientData.filter( d=> parseInt(d.clusterId) == parseInt(props.activeCluster)).length;
            let nInactive = patientData.length - nActive;
            let grid = {};
            for(let p of patientData){
                for(let [x,y] of p.points){
                    if(grid[x] === undefined){
                        grid[x] = {}
                    }
                    if(grid[x][y] === undefined){
                        grid[x][y] = [];
                        for(let i = 0; i < clusterData.length; i++){
                            grid[x][y].push(0);
                        }
                    }
                    let items = grid[x][y];
                    items[p.clusterId] = items[p.clusterId] + 1
                    grid[x][y] = items;
                }
            } 

            //define radius scale first because we need that info before formatting to make the scale
            //so it can determine which circle to put on top
            let maxInactiveTotal = 0;
            let maxActiveTotal = 0;
            for(let x of Object.keys(grid)){
                for(let y of Object.keys(grid[x])){
                    let values = grid[x][y];
                    let total = arraySum(values);
                    let activeCount = values[parseInt(props.activeCluster)];
                    maxActiveTotal = Math.max(activeCount/nActive,maxActiveTotal);
                    maxInactiveTotal = Math.max((total-activeCount)/nInactive, maxInactiveTotal);
                }
            }

            
            var makeRScale = (max) => {
                return d3.scaleSymlog().domain([0,max]).range([1,maxR])
            }
            let rScaleActive = makeRScale(maxActiveTotal);
            let rScaleInactive = makeRScale(maxInactiveTotal);
            let getRadius = (count,active) => {
                if(active){
                    return rScaleActive(count/nActive);
                } else{
                    return rScaleInactive(count/nInactive);
                }
            }

            let allPoints =[];
            let tickData = [];
            let yTicksDone = false;
            for(let x of Object.keys(grid)){

                let dates = treatmentDates[parseInt(.01+xScale.invert(parseFloat(x)))];
                if(dates === undefined){
                    dates = treatmentDates[0]
                }
                let dateString = 'Weeks: ';
                for(let date of dates){
                    dateString += date + ' ';
                }

                tickData.push({
                    x: parseInt(x),
                    name: dateString,
                    y: yScale(0) + legendFontSize + maxR,
                    position: 'middle',
                });


                for(let y of Object.keys(grid[x])){
                    let values = grid[x][y];
                    let total = arraySum(values);
                    let count = values[parseInt(props.activeCluster)];

                    let entry = {
                        'x':x,
                        'activeCount': count,
                        'total': total,
                        'inactiveCount': total-count,
                        'y':y,
                        'activeRadius': getRadius(count,true),
                        'inactiveRadius': getRadius(total-count,false),
                        'dateString': dateString,
                    }

                    allPoints.push(entry);

                    if(!yTicksDone){
                        let valIdx =  parseInt(yScale.invert(parseInt(y)));
                        let sValRange = symptomBins[valIdx];
                        let name = Math.min(...sValRange) + '-' + Math.max(...sValRange);
                        tickData.push({
                            'x': xMarginLeft + 5,
                            'y': parseInt(y) + legendFontSize/2,
                            'name': name,
                            'position': 'start',
                        });
                    }
                }
                yTicksDone = true;
            }

            const catColor = (d,active) => active? props.categoricalColors(parseInt(props.activeCluster)): 'none';
            
            let getStrokeWidth = (d,active) => active? 0:1;
            let getOpacity = (d,active) => active? 1:0;
            let getR = (d,active) => active? d.activeRadius:d.inactiveRadius;

            function plotPoints(datapoints,className,act){
                svg.selectAll('.'+className).remove();
                let getClass = (d) => d.front? className + ' symptomFront': className;
                let pointPlot = svg.selectAll('circle').filter('.'+className)
                    .data(datapoints).enter()
                    .append('circle').attr('class',getClass)
                    .attr('cx',d=>d.x)
                    .attr('cy',d=>d.y)
                    .attr('r',d=>getR(d,act))
                    .attr('fill-opacity',(d) => getOpacity(d,act))
                    .attr('stroke-width',d => getStrokeWidth(d,act))
                    .attr('stroke','black')
                    .attr('fill',d => catColor(d,act))
                    .on('mouseover',function(e){
                        let d = d3.select(this).datum();
                        let value = yScale.invert(d.y);
                        let tipText = d.dateString + '</br>'
                            + props.mainSymptom + ': ' + value + "</br>"
                            + 'in-cluster: ' + d.activeCount + ' (' + (100*d.activeCount/nActive).toFixed(1) + '%)' + '</br>'
                            + 'outof-cluster: ' +d.inactiveCount + ' (' + (100*d.inactiveCount/nInactive).toFixed(1) + '%)' + '</br>'
                            + 'odds ratio: ' + ((d.activeCount/nActive)/(d.inactiveCount/nInactive)).toFixed(2) + '</br>'
                            + 'cluster: ' + d.clusterId + "</br>"
                        tTip.html(tipText);
                    }).on('mousemove', function(e){
                        Utils.moveTTipEvent(tTip,e);
                    }).on('mouseout', function(e){
                        Utils.hideTTip(tTip);
                    });
                return pointPlot;
            }
            
            plotPoints(allPoints,'activeSymptomPoints',true);
            let rings = plotPoints(allPoints,'inactiveSymptomPoints',false);
            rings.raise();

            svg.selectAll('.symptomAxisLabel').remove()
            svg.selectAll('text').filter('.symptomAxisLabel')
                .data(tickData).enter()
                .append('text').attr('class','symptomAxisLabel')
                .attr('x',d=>d.x)
                .attr('y',d=>d.y)
                .attr('font-size',legendFontSize)
                .attr('text-anchor',d=>d.position)
                .html(d=>d.name)


            //legend code
            const legendX = Math.min(width - legendWidth, width - maxR - 10);
            var currLegendY = yMargin + maxR;
            svg.selectAll('.legendObj').remove();

            var makeLegend = (scale, maxVal, className, active) => {
                let titleEntry = {
                    x: legendX - maxR/2,
                    y: currLegendY,
                    radius: 0,
                    value: 0,
                    text: (active)? 'In Cluster ' + props.activeCluster: 'Not In Cluster ' + props.activeCluster,
                    stroke: 0,
                    fillOpacity: 0,
                    opacity: 0,
                }
                currLegendY += 18;
                let entries = [titleEntry];
                for(let i of [maxVal/6, maxVal/2,maxVal]){
                    let radius = scale(i);
                    currLegendY += radius;
                    let count = (active)? i*nActive: i*nInactive;
                    let text = count.toFixed(0) + ' (' + (100*i).toFixed(0) + '%)';
                    let entry = {
                        x: legendX + (maxR - radius),
                        radius: radius,
                        value: i,
                        text: text,
                        y: currLegendY,
                        color: catColor({},active),
                        stroke: getStrokeWidth({},active),
                        fillOpacity: getOpacity({},active),
                        opacity: 1,
                    }
                    entries.push(entry)
                    currLegendY = currLegendY + radius + 2;
                }

                
                svg.selectAll('circle').filter('.'+className).remove();
                svg.selectAll('circle').filter('.'+className)
                    .data(entries).enter()
                    .append('circle').attr('class',className + ' legendObj')
                    .attr('cx',d=>d.x)
                    .attr('cy',d=>d.y)
                    .attr('r',d=>d.radius)
                    .attr('fill',d=>d.color)
                    .attr('opacity',d=>d.opacity)
                    .attr('fill-opacity',d=>d.fillOpacity)
                    .attr('stroke-width',d=>d.stroke)
                    .attr('stroke','black');

                svg.selectAll('text').filter('.'+className).remove();
                svg.selectAll('text').filter('.'+className)
                    .data(entries).enter()
                    .append('text').attr('class',className + ' legendObj')
                    .attr('x',d=>d.x+d.radius+5)
                    .attr('y',d=>d.y)
                    .attr('text-anchor','start')
                    .attr('alignment-baseline','middle')
                    .attr('font-weight', d=> (d.opacity == 1)? '':'bold')
                    .text(d=> d.text);
                return entries;
            }
            const maxTotal = Math.max(maxActiveTotal,maxInactiveTotal)
            makeLegend(rScaleActive, maxTotal, 'activeLegend', true);
            currLegendY += 15; //spacing between active and inactive;
            makeLegend(rScaleInactive, maxTotal, 'inactiveLegend', false);
        }
    },[svg,patientData,clusterData,props.activeCluster,props.categoricalColors]);

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}

function arrayMean(array){
    let sum = 0;
    for(let val of array){
        if(val !== undefined){
            sum += val;
        }
    }
    return sum/array.length;
}

function arraySum(array){
    let sum = 0;
    for(let val of array){
        if(val !== undefined){
            sum += val;
        }
    }
    return sum;
}