import React, {useState, useEffect, useRef} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";
import PCA from '../modules/PCA.js';



export default function ScatterPlotD3(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [pcaComponents,setPCAComponents] = useState([0,3]);
    const [formattedData,setFormattedData] =useState();
    const state = (props.currState === undefined)? 2: props.currState;
    const modelOutput = props.modelOutput === undefined? 'imitation': props.modelOutput;
    const nNeighbors = 10;
    const margin = 10;


    function getFill(d){
        if(d.id < 0){
            return d.modelDecision > .5? constants.dnnColor:constants.dnnColorNo;
        }
        if(d.isNeighbor){
            return d.trueDecision > .5? constants.knnColor: constants.knnColorNo;
        }
        return d.trueDecision > .5? 'black': 'grey';
    }

    function getStroke(d){
        if(d.id < 0){
            return 'none'
        }
        if(d.isNeighbor){
            return d.modelDecision > .5? constants.knnColor: constants.knnColorNo;
        }
        return d.modelDecision > .5? 'black': 'grey';
    }

    function plotPCA(cohortEmbeddings,currEmbeddings,cohortData,patientFeatures,simulation,state){

        //simlulated patient gets id of -1
        const ids = [-1].concat(Object.keys(cohortEmbeddings).map(i=>parseInt(i)));
        // const pEmbedding = currEmbeddings['embedding'];
        const pSimilarity = currEmbeddings['similarities']
        const pNeighbors = currEmbeddings['neighbors'].map(i=>parseInt(i))
        // const embeddings =[pEmbedding].concat(Object.values(cohortEmbeddings).map(x=> x[embedkey]));
        const pPca = currEmbeddings['pca'];
        const getComp = x => [x[pcaComponents[0]],x[pcaComponents[1]]]
        var projection = [getComp(pPca)].concat(
            Object.values(cohortEmbeddings)
            .map(x=>x['pca_state'+state])
            .map(getComp)
            );

        function isNeighbor(id){
            if(id === -1){ return false}
            let pos = pNeighbors.indexOf(parseInt(id));
            if(pos > 0 & pos < nNeighbors){
                return true;
            }
            return false;
        }

        function getOpacity(id){
            if(id === -1){ return 1}
            return isNeighbor(id)? 1: .25;
        }

        function getRadius(id){
            if(id === -1){ return 13}
            return isNeighbor(id)? 8: 5;
        }

        function getClass(id){
            let className = 'patientMarker';
            if(id === -1){
                className += ' selectedPatient activePatient'
            }
            if(isNeighbor(id)){
                className += ' patientNeighbor activePatient';
            }
            
            return className
        }

        var xScale = d3.scaleLinear()
            .domain(d3.extent(projection.map(d=>d[0])))
            .range([margin,width-margin]);
        var yScale = d3.scaleLinear()
            .domain(d3.extent(projection.map(d=>d[1])))
            .range([height-margin,margin]);

        var data = [];
        for(let i in projection){
            let coords = projection[i];
            let id = ids[i]

            let entry = {
                'x': xScale(coords[0]),
                'y': yScale(coords[1]),
                'opacity': getOpacity(id),
                'radius': getRadius(id),
                'className': getClass(id),
                'id': parseInt(id),
                'isNeighbor': isNeighbor(id),
                'data': cohortData[id+''],
            }
            if(id > 0){
                entry['modelDecision'] = cohortEmbeddings[id+'']['decision'+state+'_'+props.modelOutput];
                entry['trueDecision'] =cohortData[id+''][constants.DECISIONS[state]];
                entry['embeddings'] = cohortEmbeddings[id+'']
            } 
            else{
                entry['modelDecision'] = simulation[props.modelOutput]['decision'+(state+1)];
                entry['trueDecision'] = -1;
                entry['embeddings'] = entry['modelDecision'];
            }
            data.push(entry);
        }
        // console.log('scatterplot data',data)
        setFormattedData(undefined);
        setFormattedData(data);
    }

    useEffect(()=>{
        if(formattedData === undefined | svg===undefined){ return }
        // svg.selectAll('.patientMarker').remove();
        let points = svg.selectAll('.patientMarker').data(formattedData,d=>d.id);
        if(points.empty()){
            points
            .enter()
            .append('circle').attr('class',d=>d.className)
            .attr('transform',d=>'translate(' + d.x + ',' + d.y+')')
            .attr('fill',getFill)
            .attr('stroke',getStroke)
            .attr('opacity',d=>d.opacity)
            .attr('stroke-width',3)
            .attr('r',d=>d.radius);
            svg.selectAll('.activePatient').raise();
            svg.selectAll('.selectedPatient').raise();
        } else{
            points
                .attr('class',d=>d.className)
                .transition()
                .duration(500)
                .attr('transform',d=>'translate(' + d.x + ',' + d.y+')')
                .attr('fill',getFill)
                .attr('stroke',getStroke)
                .attr('opacity',d=>d.opacity)
                .attr('stroke-width',3)
                .attr('r',d=>d.radius)
                .on('end', ()=>{
                    svg.selectAll('.activePatient').raise();
                    svg.selectAll('.selectedPatient').raise();
                });
            points.exit().remove();
        }
        points.on('mouseover',function(e,d){
            if((d.id > 0) & (parseInt(d.id) !== parseInt(props.brushedId))){
                props.setBrushedId(parseInt(d.id));
            }
            let string = d.id;
            string += '</br> model decision ' + d.modelDecision;
            string += '</br> true decision ' + d.trueDecision;
            console.log('brush',d.embeddings)
            tTip.html(string);
        }).on('mousemove', function(e){
            Utils.moveTTipEvent(tTip,e);
        }).on('mouseout', function(e){
            Utils.hideTTip(tTip);
            props.setBrushedId();
        }).on('dblclick',(e,d)=>{
            let pData = props.cohortData[d.id+''];
            console.log('scatterplot click',pData)
            if(pData !== undefined){
                //second argument clears the previous stuff
                props.updatePatient(pData,true);
            }
        })
        

    },[formattedData]);
    
    useEffect(()=>{
        if(svg === undefined | formattedData === undefined){ return }
        if(svg.selectAll('.patientMarker').empty()){return}
        svg.selectAll('.patientMarker')
            .attr('class',d=>d.className)
            .transition(500)
            .attr('stroke',getStroke)
            .attr('fill',getFill)
            .on('end', ()=>{
                svg.selectAll('.activePatient').raise();
                svg.selectAll('.selectedPatient').raise();
            });

    },[modelOutput,formattedData]);

    

    useEffect(()=>{
        let toTest = [props.cohortEmbeddings,
            props.cohortData,props.patientFeatures,props.currEmbeddings,props.simulation];
        if(Utils.allValid(toTest)){
            if(props.simulation[props.modelOutput] === undefined){return}
            plotPCA(
                props.cohortEmbeddings,props.currEmbeddings,
                props.cohortData,props.patientFeatures,props.simulation,state);
        } 
        else{
            console.log('no')
        }
        
    },[svg,
        props.patientFeatures,
        props.simulation,
        props.cohortEmbeddings,
        props.currEmbeddings,
        props.cohortData,
        props.modelOutput,
        props.currState,
        state])

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}