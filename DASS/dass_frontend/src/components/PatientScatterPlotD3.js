import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'
import {forceSimulation,forceCollide} from 'd3';
import { transition } from 'd3-transition';

export default function PatientScatterPlotD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [formattedData,setFormattedData] = useState();
    const [dotsDrawn,setDotsDrawn] = useState(false);
    const maxR = 1.25*Math.log(Math.min(width,height)+1);
    const margin = Math.min(80,2*maxR);
    const leeway = Math.min(4*maxR,80);//space to give before the simulation aglroithm
    const curveMargin = 3;
    
    
    const legendHeight = 80;
    const legendWidth = 60;
    const legendMargin = 30;
    
    function rScale(val){
        return maxR*(val**.25);
    }

    function getR(d){
        //if I want to make this fancy
        //in the proproccessing I make thes all unitl scale
        let val = d[props.sizeVar] + .1;
        if(val === undefined){
            val = .4;
        }
        return rScale(val);
    }

    function radToCartesian(angle,scale=1){
        let x = Math.cos(angle)*scale;
        let y = Math.sin(angle)*scale;
        return [x,y];
    }

    function circlePath(r){
        let path = 'm 0,0 '
            + 'M ' + (-r) + ', 0 '
            + 'a ' + r + ',' + r + ' 0 1,0 ' + (2*r) + ',0 '
            + 'a ' + r + ',' + r + ' 0 1,0 ' + (-2*r) + ',0 z';
        return path;
    }

    function valToShape(val,size){
        if(size === undefined){
            size = rScale(val);
        }
        if(val === undefined){
            return d3.symbol().size(size).type(d3.symbolSquare);
        }
        let string = circlePath(size) + ' M 0,0 ';
        let currAngle = -Math.PI/2;
        var arcLength = 2*Math.PI/11;
        var addArc = (pString,angle) => {
            let [x,y] = radToCartesian(angle);
            let newString = " L" + size*x + ',' + size*y + ' 0,0';
            return pString + newString;
        }
        for(let i = 0; i < val; i += .1){
            string = addArc(string,currAngle);
            currAngle += arcLength;
        }
        return string;
    }

    function getShape(d){
        let val = d[props.sizeVar];
        let size = getR(d);
        return valToShape(val,size);
    }

    function getMaxSymptoms(pEntry,symptom,dates){
        if(dates == undefined){
            dates = props.endpointDates;
        }
        let val = pEntry['symptoms_'+symptom];
        if(val === undefined | pEntry.dates === undefined){
            return -1;
        }
        let dateIdxs = dates.map(x => pEntry.dates.indexOf(x)).filter(x => x > -1);
        let values = dateIdxs.map(i => val[i]).filter(x => x!==undefined);
        if(values.length > 1){
            return Math.max(...values);
        } else{
            return values[0];
        }
    }

    useEffect(function formatData(){
        if(props.doseData != undefined & props.clusterData !== undefined){
            console.log('updating data');
            setFormattedData(undefined);
            function formatData(d){
                let newD = Object.assign(d,{})
            
                for(let prefix of ['cluster_organ','dose','symptom_all','symptom_post','symptom_treatment']){
                    let pcaVal = d[prefix+'_pca']
                    for(let num of [1,2,3]){
                        newD[prefix+'_pca'+num] = pcaVal[num-1];
                    }
                }
            
                let valMap = {
                    't1': 1/4,
                    't2': 2/4,
                    't3': 3/4,
                    't4': 4/4,
                    'n2a': 1/4,
                    'n2b': 2/4,
                    'n2c': 3/4,
                    'n3': 4/4,
                }
                function fromMap(v){
                    let val = valMap[v];
                    if(val === undefined){ val = 0; }
                    return val
                }
                newD.tstage = fromMap(d.t_stage);
                newD.nstage = fromMap(d.n_stage);
        
                // let dateSliceStart = d.dates.indexOf(13);
                // let dateSliceStop = d.dates.indexOf(33);
                for(let sympt of props.symptomsOfInterest){
                    // let svals = d['symptoms_'+sympt].slice(dateSliceStart,dateSliceStop+1)
                    // newD[sympt] = Math.max(...svals)/10;
                    newD[sympt] = getMaxSymptoms(d, sympt, props.endpointDates)/10
                }
                return newD;
            }

            var dataPoints = [];
            props.clusterData.forEach((clusterEntry,i)=>{
                let d = Object.assign(clusterEntry,{})
                for(let id of d.ids){
                    let dpoint = props.doseData.filter(d=>d.id == id)[0];
                    if(dpoint !== undefined){
                        dpoint = formatData(dpoint);

                        let newPoint = {
                            'cluster': d.clusterId,
                            'color': props.categoricalColors(d.clusterId),
                            'id': id,
                        }
                        newPoint = Object.assign(dpoint,newPoint)
                        dataPoints.push(newPoint);
                    }
                }
            });
            setFormattedData(dataPoints);

        }
    },[props.clusterData,props.doseData,props.endpointDates,props.clusterOrgans])

    useEffect(function drawPoints(){
        if(svg !== undefined & formattedData !== undefined & height > 0 & width > 0 & props.xVar !== undefined & props.yVar !== undefined){
            setDotsDrawn(false);
            svg.selectAll('.clusterOutline').remove();
            function getScale(varName, range){
                let extents = d3.extent(formattedData.map((d) => d[varName]));
                let scale = d3.scaleLinear()
                    .domain(extents)
                    .range(range)
                return d => scale(d[varName])
            }
            let getX = getScale(props.xVar,[margin + 2*maxR + leeway,width-margin - 2*maxR - leeway])
            let getY = getScale(props.yVar, [height-margin-2*maxR-leeway,margin+2*maxR+leeway])
            // let getR = getScale(props.sizeVar, [1,5])//when i make it point scaled instead of shapes
            let newData = [];
            for(let e of formattedData){
                e.x = getX(e);
                e.y = getY(e);
                newData.push(e);
            }

            let scatterGroup = svg.selectAll('.scatterPoint').data(formattedData);
            scatterGroup.exit().remove();

            function drawHull(dataList){
                var hullData = [];
                var curveFunc = d3.line(d=>d[0],d=>d[1])
                    .curve(d3.curveCatmullRom.alpha(0.1))
                props.clusterData.forEach((clusterEntry,i)=>{
                    let cid = clusterEntry.clusterId;
                    let dpoints = dataList.filter(x=>x.cluster == cid);
                    if(dpoints.length >= 3){
                        var [minX,maxX,minY,maxY] = [100000,0,100000,0]
                        let points = dpoints.map((d)=>{
                            let tempx = d.x;
                            let tempy = d.y;
                            minX = Math.min(minX,tempx);
                            minY = Math.min(minY,tempy);
                            maxX = Math.max(maxX,tempx);
                            maxY = Math.max(maxY,tempy);
                            return [d.x,d.y]
                        });
                        let hull = d3.polygonHull(points);
                        hull.push(hull[0]);

                        let centerX = minX + (maxX - minX)/2;
                        let centerY = minY + (maxY - minY)/2;
                        hull = hull.map(([x,y])=>{
                            let offsetX = x-centerX;
                            let offsetY = y-centerY;
                            let modifier = curveMargin/((offsetX**2) + (offsetY**2))**.5
                            let newX = x + offsetX*modifier;
                            let newY = y + offsetY*modifier;
                            return [newX,newY];
                        });
                        let entry = {
                            'path': curveFunc(hull),
                            'color': props.categoricalColors(cid),
                            'cluster': parseInt(cid),
                            'active': (parseInt(cid) === parseInt(props.activeCluster)),
                            'nItems': dpoints.length,
                        }
                        hullData.push(entry)
                    }
                })
                
                var clusterOutlines = svg.selectAll('.clusterOutline')
                    .data(hullData).enter()
                    .append('path')
                    .attr('class','clusterOutline')
                    .attr('d',d=>d.path)
                    .attr('stroke',d=>d.color)
                    .attr('stroke-width',2)
                    .attr('fill','none')
                    .attr('stroke-opacity',1)
                    .attr('visibility',d=>d.active?'visible':'hidden');

                clusterOutlines
                    .on('mouseover',function(e){
                        let d = d3.select(this).datum();
                        let tipText = 'cluster ' + d.cluster + ' n=' + d.nItems;
                        tTip.html(tipText);
                    }).on('mousemove', function(e){
                        Utils.moveTTipEvent(tTip,e);
                    }).on('mouseout', function(e){
                        Utils.hideTTip(tTip);
                    }).on('dblclick',function(e){
                        let d = d3.select(this).datum();
                        if(props.activeCluster !== d.cluster){
                            props.setActiveCluster(d.cluster)
                        }
                    });
                
            }
            function boundX(d){return Math.max(maxR+margin, Math.min(width-maxR-margin, d.x))}
            function boundY(d){return Math.max(maxR+margin, Math.min(height-maxR-margin, d.y))}
            function uncollide(){
                var ticked = function(){
                    //bound to edges of svg
                    svg.selectAll('.scatterPoint')
                        .attr('transform',d=> {return 'translate(' + boundX(d) + ',' + boundY(d) + ')';});
                }
    
                forceSimulation(newData)
                    .force('collide',forceCollide().radius(getR))
                    .alphaMin(.3)
                    .on('tick',ticked)
                    .on('end',function(){
                        drawHull(newData);
                        setDotsDrawn(true);

                    })
            }

            if(scatterGroup.empty()){
                scatterGroup
                    .enter().append('path')
                    .attr('class','scatterPoint')
                    .attr('transform',d=> {return 'translate(' + d.x + ',' + d.y + ')';})
                    .attr('d',getShape)
                    .attr('fill', d => d.color);

                // onHover(scatterGroup);
                // uncollide();
            }
            function getTransition(){
                return transition()
                    .duration(400)
                    .on('end',uncollide);
            } 

            scatterGroup
                .enter().append('path')
                .merge(scatterGroup)
                .attr('class','scatterPoint');

            scatterGroup.exit().remove();

            scatterGroup
                .transition(getTransition())
                .attr('transform',d=> {return 'translate(' + d.x + ',' + d.y + ')';})
                .attr('d',getShape)
                .attr('fill', d => d.color);
            
        }
    },[svg,height,width,props.clusterData,formattedData,props.xVar,props.yVar,props.sizeVar,props.clusterOrgans])

    useEffect(function makeShape(){
        if(formattedData !== undefined & dotsDrawn & props.sizeVar !== undefined){
            //fill in pinwheel shape after simulation is done for layout
            svg.selectAll('.scatterPoint')
                .attr('d',getShape);
            //stuff for drawing the legend
            //figure out the corner that it's best to draw in

            //get clostest point to each corner
            let ltDist = 10000;
            let rtDist = 10000;
            let lbDist = 10000;
            let rbDist = 10000;
            let distSquared = (d,x0,y0) => {
                //distance squared is faster than just distanc
                let vect = (d.x - x0)**2 + (d.y -y0)**2;
                return vect
            }
            let minDist = (d,x0,y0,currMin) =>{
                let dist = distSquared(d,x0,y0)
                if(dist < currMin){
                    return dist;
                } 
                return currMin;
            }
            svg.selectAll('.scatterPoint').each((d,i)=>{
                ltDist = minDist(d,0,0,ltDist);
                rtDist = minDist(d,width,0,rtDist);
                lbDist = minDist(d,0,height,lbDist);
                rbDist = minDist(d,width,height,rbDist);
            });
            //calibrate start position baseed on the corner
            var legendTop = height - legendHeight;
            var legendLeft = legendMargin;
            const minCorner = Math.max(ltDist,rtDist,lbDist,rbDist);
            let titleLeft = true;
            if(rtDist === minCorner | rbDist === minCorner){
                legendLeft = width - legendWidth;
                titleLeft = false;
            }
            if(ltDist === minCorner | rtDist === minCorner){
                legendTop = legendMargin;
            }
            //values = 0 is special case for the legend title
            //other values are the ones included in the legend
            const legendVals = [0,.1,.5,.9];
            let currY = legendTop;
            var legendData = legendVals.map((v) => {
                let shape = valToShape(v);
                let textX = legendLeft + 2*maxR+1;
                let fontSize = (v===0)? 2.2*maxR:2*maxR;
                if(v === 0){
                    if(titleLeft){
                        textX += props.sizeVar.length*fontSize/5;
                    }
                    else{
                        textX -= props.sizeVar.length*fontSize/5;
                    }
                } else{
                    textX += 5;
                }
                let entry = {
                    y: currY,
                    shape: shape,
                    x: legendLeft + maxR,
                    isTitle: (v === 0),
                    textX: textX,
                    text: (v===0)? props.sizeVar : (10*v).toFixed(0),
                    fontSize: fontSize,
                    fontWeight: (v===0)? 'bold':'',
                }
                currY += 2*maxR;
                return entry;
            })
            
            svg.selectAll('.legendShapes').remove();
            svg.selectAll('.legendShapes')
                .data(legendData).enter()
                .append('path')
                .attr('class','legendShapes')
                .attr('transform',d=> 'translate(' + d.x + ',' + d.y + ')')
                .attr('d',d=>d.shape)
                .attr('fill','gray')
                .attr('stroke','black')
                .attr('stroke-width',1)
                .attr('visibility',d=>d.isTitle? 'hidden':'visible');

            svg.selectAll('.legendText').remove();
            svg.selectAll('.legendText').data(legendData)
                .enter().append('text')
                .attr('class','legendText')
                .attr('x',d=>d.textX)
                .attr('y',d=>d.y+1)
                .attr('text-anchor','middle')
                .attr('alignment-baseline','middle')
                .attr('font-size',d=>d.fontSize)
                .attr('font-weight',d=>d.fontWeight)
                .text(d=> d.text)
        }
    },[svg,props.clusterData,formattedData,dotsDrawn,props.sizeVar,props.xVar,props.yVar,props.clusterOrgans]);

    useEffect(function brush(){
        if(formattedData !==undefined & dotsDrawn){
            svg.selectAll('scatterPoint').remove();
            let scatterGroup = svg.selectAll('.scatterPoint').data(formattedData);
            scatterGroup.exit().remove();
            
            let isActive = (d) => parseInt(d.cluster) === parseInt(props.activeCluster);
            let isSelected = (d) => (parseInt(d.id) === props.selectedPatientId);
            scatterGroup
                .enter()
                .append('circle').attr('class','scatterPoint')
                .merge(scatterGroup)
                .attr('opacity', (d)=> isActive(d)? 1:.75)
                .attr('stroke','black')
                .attr('stroke-width', (d) => {
                    let w = 1;
                    if(isSelected(d)){
                        w *= 1.5;
                    }
                    return w;
                }).on('mouseover',function(e){
                        let d = d3.select(this).datum();
                        let tipText = 'patient ' + d.id + '</br>'
                            + 'cluster: ' + d.cluster + '</br>'
                            + props.xVar + ': ' + d[props.xVar].toFixed(1) + '</br>'
                            + props.yVar + ': ' + d[props.yVar].toFixed(1) + '</br>'
                            + props.sizeVar + ': ' + d[props.sizeVar].toFixed(1) + '</br>'

                        tTip.html(tipText);
                        props.makeTTipChart(tTip,d);
                        props.makeTTipLrtChart(tTip,d);
                    }).on('mousemove', function(e){
                        Utils.moveTTipEvent(tTip,e);
                    }).on('mouseout', function(e){
                        Utils.hideTTip(tTip);
                        tTip.selectAll('svg').remove()
                    }).on('dblclick',function(e){
                        let d = d3.select(this).datum();
                        if(parseInt(d.cluster) !== parseInt(props.activeCluster)){
                            props.setActiveCluster(parseInt(d.cluster));
                        } 
                        if(d.id !== props.selectedPatientId){
                            props.setSelectedPatientId(parseInt(d.id));
                        }
                });
            
                //brush active cluster
                svg.selectAll('.clusterOutline')
                    .attr('visibility',d=>isActive(d)?'visible':'hidden');
        }
    },[props.clusterData,formattedData,dotsDrawn, 
        props.selectedPatientId,props.activeCluster,
        props.makeTTipChart,props.makeTTipLrtChart]);

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}