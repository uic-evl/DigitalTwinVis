import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'

export default function Dose2dCenterViewD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [pathsDrawn, setPathsDrawn] = useState(false);

    const tipChartSize = [250,150];
    const tipDvhValues = [5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80];

    const maxQuants = 4;
    const [box,setBox] = useState();

    function reduceQuantiles(values){
        //function because I originally had 6 quantiles but I have to manually make the curves and > 3 doesnt work good
        //currently maxed at 3.  can't think of elegent way to do an arbitrary number that makes sense
        let nQuants = values.length;
        if(maxQuants >= nQuants){
            return values;
        }
        let middle = Math.round(((nQuants-1)/2));
        let newVals;
        if(maxQuants == 1){
            newVals = values[middle];
        } else if(maxQuants == 2){
            newVals =  [values[0],values[nQuants-1]]
        } else if (maxQuants == 3){
            newVals = [values[0],values[middle],values[nQuants-1]];
        } else{
            let floor = Math.floor((nQuants-1)/2);
            let ceil = Math.ceil((nQuants-1)/2);
            if(floor === ceil){
                floor -= 1;
                ceil += 1;
            }
            newVals = [values[0],values[floor],values[ceil], values[nQuants-1]]
        }
        return newVals
    }

    function addClusterDvh(element, data,organ,nQuants,colorFunc){
        element.selectAll('svg').remove();
        const margin = 3;
        const bottomMargin = 15;
        let [w,h] = tipChartSize;

        let tipSvg = element.append('svg')
            .attr('width',w)
            .attr('height',h)
            .style('background','white');

        //data comes in preset qunatiles for each "vX" entry
        //format it like row = qunatile, col = vX so nQuants x tipDvhValues.lenght
        let vals = [];
        for(let i = 0; i < nQuants; i++){
            vals.push([]);
        }
        //names of tipDvhValues
        let valNames = [];
        let maxV = 100;//100 is default max for DVH 
        let minV = 100;
        let putLegendInBottomLeft = true;
        //get data points
        for(let v of tipDvhValues){
            let oString = organ + '_V' + v;
            if(data[oString] !== undefined){
                let vv = data[oString];
                vv = reduceQuantiles(vv);
                if(putLegendInBottomLeft & v <= 25 & vv[0] < 35){
                    putLegendInBottomLeft = false;
                }
                for(let i = 0; i < vv.length; i++){
                    let valentry = vals[i];
                    valentry.push(vv[i]);
                    vals[i] = valentry;
                    maxV = Math.max(maxV,vv[i]);
                    minV = Math.min(minV, vv[i])
                }
                valNames.push('V'+v);
            }
        }

        //plot lines
        const tipXScale = d3.scaleLinear()
            .domain([0,vals[0].length])
            .range([margin,w-margin]);
        const tipYScale = d3.scaleLinear()
            .domain([0,100])
            .range([h-bottomMargin,margin])
        let paths = [];
        let lineFunc = d3.line();
        for(let vi in vals){
            let vList = vals[vi];
            let pointList = [];
            let meanVal = 0;
            for(let vvii in vList){
                let v = vList[vvii];
                meanVal += v;
                let x = tipXScale(vvii);
                let y =tipYScale(v);
                pointList.push([x,y])
            }
            meanVal /= vList.length;
            let pathEntry = {
                'path': lineFunc(pointList),
                'quant': parseInt(vi),
                'mean': meanVal,
                'color': colorFunc(.6*meanVal+40),
            }
            paths.push(pathEntry);
        }
        
        //actually plotting the lines
        tipSvg.selectAll('path').filter('.tTipDvhLine')
            .data(paths).enter()
            .append('path').attr('class','tTipDvhLine')
            .attr('d',d=>d.path)
            .attr('stroke-width',2)
            .attr('stroke',d=>d.color)
            .attr('fill','none');


        //show x axis
        let ticks = [];
        //show every other x point
        let isOdd = false;
        const fontSize = Math.min(13, Math.min(w,h)*.11);
        for(let i in valNames){
            if(isOdd){
                let entry = {
                    name: valNames[i],
                    x: tipXScale(i),
                    y: h - bottomMargin + fontSize,
                }
                ticks.push(entry)
            }
            isOdd = !isOdd;
        }

        //plotting the x axis
        tipSvg.selectAll('text').filter('tipXAxis')
            .data(ticks).enter()
            .append('text').attr('class','tipXAxis')
            .attr('x',d=>d.x)
            .attr('y',d=>d.y)
            .attr('text-anchor','middle')
            // .attr('textLength',(w-2*margin)/(vals[0].length/2) )
            .attr('font-size',fontSize)
            .html(d=>d.name)

        let legendBlocks = [];
        let legendText = [];
        const legendBlockSize = 8;
        const legendTextWidth = 4*legendBlockSize;
        const legendMargin = 2;
        let estHeight = (nQuants)*(legendBlockSize + legendMargin);
        var legendX = parseInt(w) - parseInt(margin) - legendBlockSize - 2 - legendTextWidth;
        var legendY = parseInt(margin) + estHeight - legendBlockSize;
        if(putLegendInBottomLeft){
            
            legendY = h - bottomMargin - legendBlockSize;
            legendX = margin;
        }
        let qIncrement = 100/(nQuants);
        let currQBase = 0;
        for(let pData of paths){
            let lBlockEntry = {
                'x': legendX,
                'y': legendY,
                'color': pData.color,
                'mean': pData.mean,
            }
            let lTextEntry = {
                'x': legendX + legendBlockSize + 2,
                'y': legendY + legendBlockSize,
                'text':currQBase.toFixed(0) + '-'+ (currQBase+qIncrement).toFixed(0) + '%',
            }
            legendBlocks.push(lBlockEntry);
            legendText.push(lTextEntry);
            legendY -= legendMargin + legendBlockSize;
            currQBase += qIncrement;
        }
        tipSvg.selectAll('.tipLegend').remove();
        let g = tipSvg.append('g').attr('class','tipLegend');

        g.selectAll('rect').filter('.tipLegendRect')
            .data(legendBlocks).enter()
            .append('rect').attr('class','tipLegendRect')
            .attr('x',d=>d.x)
            .attr('y',d=>d.y)
            .attr('fill',d=>d.color)
            .attr('stroke','none')
            .attr('width',legendBlockSize)
            .attr('height',legendBlockSize);

        g.selectAll('text').filter('.tipLegendText')
            .data(legendText).enter()
            .append('text').attr('class','tipLegendText')
            .attr('x',d=>d.x)
            .attr('y',d=>d.y)
            .attr('text-align','start')
            .attr('textLength',legendTextWidth)
            .attr('font-size',legendBlockSize + 2)
            .html(d=>d.text);


    }


    useEffect(function draw(){
        var nQuants = 0;
        // var maxDVal = 70;
        if(svg !== undefined & props.svgPaths !== undefined & props.data != undefined & height > 0 & width > 0 & props.doseColor !== undefined){
            svg.selectAll('text').remove()
            svg.selectAll('g').selectAll('path').remove();
            svg.selectAll('path').remove();
            setPathsDrawn(false);
            let orient = props.orient;
            // if(props.orient == 'side'){
            //     orient='left';
            // }
            var paths = props.svgPaths[orient];
            let organList = Object.keys(paths)
            let pathData = [];
            let maxDVal = 0;
            for(const organ of organList){
                if(!props.showContralateral & organ.includes('Rt_')){
                    continue;
                }
                let key = organ + '_' + props.plotVar;
                let vals = props.data[key];
            

                if(vals === undefined){ continue; }
                vals = reduceQuantiles(vals);
                if(nQuants == 0){
                    nQuants = vals.length;
                }
                
                for(let i in vals){
                    let pName = organ;
                    if(i > 0){
                        pName += (parseInt(i)+1)
                    }
                    let path = paths[pName];

                    let entry = {
                        'path':path,
                        'path_name':pName,
                    }
                    let scale =  Math.pow(.75,i);
                    entry.scale= scale;
                    entry.dVal = vals[i];
                    entry.transform = 'scale('+scale+','+scale+')';

                    //stuff for tooltip
                    entry.organ_name = organ;
                    entry.lowerRange = i*(100/vals.length);
                    entry.upperRange = entry.lowerRange + (100/vals.length);
                    entry[props.plotVar] = vals[i];
                    for(let subkey of ['mean_dose','volume']){
                        let skey = organ+'_'+subkey;
                        if(props.data[skey] !== undefined){
                            entry[subkey] = props.data[skey][i]
                        }
                    }
                    if(vals[i] > maxDVal){ maxDVal = vals[i]; }
                    pathData.push(entry)
                }
            }
            if(props.maxDose < maxDVal){
                props.setMaxDose(maxDVal);
            } else{
                maxDVal = props.maxDose;
            }
            svg.selectAll('g').filter('.organGroup').remove();
            svg.selectAll('text').filter('.positionLabels').remove();
            
            const organGroup = svg.append('g')
                .attr('class','organGroup');
            
            //old code for when i tried arbitrary transforms for quantiles that doesnt work becuase javascript is dumb
            // let organShapes = organGroup
            //     .selectAll('path').filter('.organPath')
            //     .data(pathData)
            //     .enter().append('path')
            //     .attr('class','organPath')
            //     .attr('d',x=>x.path)
            //     .attr('stroke-width',0);
        
            // var transforms = [];
            // d3.selectAll('.organPath').filter('path').each((d,i,j)=>{
            // var tform = '';
            // if(d.scale < 1 & j[i] !== undefined & j[i].getBBox() !== undefined){
            //     let bbox = j[i].getBBox();
            //     let scale = d.scale;
            //     let transform = 'scale('+scale+','+scale+') ';
            //     let tY = (1-scale)*(bbox.y + bbox.height*.5);
            //     let tX = (1-scale)*(bbox.x + bbox.width*.5);
            //     transform =  'translate(' + tX + ',' + tY + ')' + transform;
            //     tform = transform;
            // }
            // transforms.push(tform);
            // });

            organGroup.selectAll('.organPath').remove();
            var getColor = d => props.doseColor(d/maxDVal);
            // var getColor = v => d3.interpolateReds(v/maxDVal)
            let organShapes = organGroup
                .selectAll('path').filter('.organPath')
                .data(pathData)
                .enter().append('path')
                .attr('class','organPath')
                .attr('d',x=>x.path)
                .attr('fill', x=>getColor(x.dVal) )
                .attr('stroke','black')
                .attr('stroke-width','0')
                .on('mouseover',function(e){
                    let d = d3.select(this).datum();
                    let tipText = d.organ_name + ' (' + d.path_name + ')' + '</br>' 
                        + 'Quantile: ' + d.lowerRange.toFixed(1) + '% -' + d.upperRange.toFixed(1) + '%' + '</br>'
                        + props.plotVar + ': ' + d.dVal.toFixed(1) + '</br>'
                        + 'Mean Dose: ' + d.mean_dose.toFixed(1) + '</br>'
                    + 'Volume: ' + d.volume.toFixed(2) +'</br>';
                    tTip.html(tipText);
                    addClusterDvh(tTip,props.data,d.organ_name,nQuants,getColor);
                    
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                    tTip.selectAll().remove();
                }).on('contextmenu',function(e){
                    e.preventDefault();
                    let d = d3.select(this).datum();
                    let organ = d.organ_name;
                    props.addOrganToCue(organ);
                });

            //this used to be a seperate hook but was bad
            //transforms stuff after it was udpated
            svg.selectAll('.organLabel').remove();
            let box = svg.node().getBBox();
            let translate = 'translate(' + (-box.x)*(width/box.width)  + ',' + (-box.y)*(height/box.height) + ')'
            let scale = 'scale(' + width/box.width + ',' + (-height/box.height) + ')';
            let transform = translate + ' ' + scale
            svg.selectAll('g').attr('transform',transform);
            setBox(box);

            setPathsDrawn(true)
        }
    },[props.data,svg,props.svgPaths,props.plotVar,props.showContralateral,props.doseColor])


    useEffect(function brushSelected(){

        if(svg !== undefined & pathsDrawn){
            //doing this the easy way with classes makes the positions wronge for some reason
            var isActive = d => (props.clusterOrgans.indexOf(d.organ_name) > -1);
            var inCue = d => (props.clusterOrganCue.indexOf(d.organ_name) > -1);
            function getStrokeWidth(d){
                if(d.scale == 1){
                    if(isActive(d)){
                        return .6;
                    } 
                    if(inCue(d)){
                        return .5;
                    } else{
                        return .01;
                    }
                } 
                return 0
            }

            function getStrokeColor(d){
                if(isActive(d) & inCue(d)){ return props.parameterColors.both;}
                if(isActive(d)){ return props.parameterColors.current; }
                if(inCue(d)){ return props.parameterColors.cue; }
                return props.parameterColors.none;
            }
            svg.selectAll('.organPath')
                .attr('stroke-width',getStrokeWidth)
                .attr('stroke',getStrokeColor)
                .on('contextmenu',function(e){
                    e.preventDefault();
                    let d = d3.select(this).datum();
                    let organ = d.organ_name;
                    props.addOrganToCue(organ);
                });

            //this also breaks it and I have no idea why because this is an obscure approach
            // svg.selectAll('.organPath').filter(d=>isActive(d)).raise();
        }
    },[props.data,svg,pathsDrawn,props.clusterOrgans,props.clusterOrganCue])


    useEffect(()=>{
        if(svg === undefined){ return; }
        if(box !== undefined){
            let labelData = [];
            let getTransform = (y) => {
                let tform = 'translate(0, ' + -((box.y + box.height/2) - y) +') ' ;
                tform += 'scale(1,-1) ' 
                tform += 'translate(0,' + ((box.y + box.height/2) - y) + ')';
                return tform;
            }
            if(props.showOrganLabels){
                svg.selectAll('.organPath').each((d,i,j) => {
                    if(d.organ_name === d.path_name){ 
                        let bbox = j[i].getBBox();
                        let organ = d.organ_name;
                        //trial and error tweaking names so they are small but readable ish
                        let name = Utils.truncateOrganNames(organ);
                        let fSize =  1.5*(bbox.width/name.length);
                        fSize = Math.min(5, Math.max(2.5,fSize))
                        let entry = {
                            x: bbox.x + bbox.width/2,
                            y: bbox.y + (bbox.height/2),
                            text: name,
                            fontSize: fSize,
                            textWidth: bbox.width*.8,
                            oData: d,
                            isOrgan: true,
                        }
                        //just trial and error making submandibular gland and digastric not collide
                        entry = Utils.adjustOrganSpacing(organ,entry);
                        entry.transform = getTransform(entry.y);
                        labelData.push(entry);
                    }
                })
            } 

            const sideLabelsDrawn = !svg.selectAll('.organTitle').empty();
            if(!sideLabelsDrawn){
                //this part draws 'contralateral' and 'ipsilateral' directly over the lateral pterygoids on each side
                var rLabel = false;
                var lLabel = false;
                svg.selectAll('.organPath').each((d,i,j) => {
                    if(d.organ_name.includes('Lateral_Pterygoid')){ 
                        let organ = d.organ_name;
                        //trial and error tweaking names so they are small but readable ish
                        const isLeft = organ.includes('Lt_');
                        if((isLeft & !lLabel) | (!isLeft & !rLabel)){
                            let bbox = j[i].getBBox();
                            let text = isLeft? 'Ipsilateral':'Contralateral'
                            let fSize =  2.2*(bbox.width/text.length);
                            fSize = Math.min(10, Math.max(2.5,fSize))
                            let entry = {
                                x: bbox.x + bbox.width/2,
                                y: bbox.y + (bbox.height/2) + fSize*2.5,
                                text: text,
                                fontSize: 1.25*fSize,
                                textWidth: bbox.width,
                                oData: d,
                                isOrgan: false,
                            }
                            entry.transform = getTransform(entry.y);
                            labelData.push(entry);
                            if(isLeft){ 
                                lLabel = true; 
                            } else{ 
                                rLabel = true;
                            }

                        }
                        //just trial and error making submandibular gland and digastric not collide
                    }
                })
            }

            if(labelData.length > 1){
                svg.selectAll('.organLabel').remove();
                // svg.selectAll('.organTitle').remove();
                let organGroup = svg.select('g').filter('.organGroup');
                let labels = organGroup.selectAll('.organText')
                    .data(labelData).enter()
                    .append('text').attr('class',d=> d.isOrgan? 'orangText organLabel': 'oragnText organTitle')
                    .attr('x',d=>d.x)
                    .attr('y',d=>d.y)
                    .attr('font-size',d=>d.fontSize)
                    .attr('text-anchor','middle')
                    .attr('dominant-baseline','central')
                    .attr('font-weight','bold')
                    .attr('font-style',d=>d.isOrgan? '':'italic')
                    .attr('transform',d=>d.transform)
                    .attr('stroke',d => d.isOrgan? 'white':'')
                    .attr('stroke-width',d=> d.isOrgan? .01*d.fontSize : 0)
                    .attr('pointer-events','none')
                    .attr('text-decoration',d=> d.isOrgan? '':'underline')
                    .text(d=>d.text);
            }
        } 
        if(!props.showOrganLabels){
             let labels = svg.selectAll('.organLabel');
             if(labels !== undefined){ labels.remove();}
        }
    },[svg,box, props.showOrganLabels])

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}