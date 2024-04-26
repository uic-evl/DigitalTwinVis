import React, {useState, useEffect, useRef} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';
import PatientPlot3D from './PatientPlot3D.js';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import * as THREE from "three";
import {VTKLoader } from 'three/examples/jsm/loaders/VTKLoader.js'


function getMaterialArray(renderer){
    const textureLoader = new THREE.TextureLoader();
    var materialArray = [];
    const getMaterial = (s) => {
        let t = textureLoader.load('textures/' + String(s) + '.png');
        if(renderer !== undefined){
            t.anisotropy = renderer.getMaxAnisotropy();
        }
        let material = new THREE.MeshBasicMaterial({map: t});
        materialArray.push(material);
    }
    const files = ['right','left','superior','inferior','anterior','posterior']
    for(let f of files){
        getMaterial(f);
    }
    return materialArray;
}


export default function OrganView(props){

    const [patientViews, setPatientViews] = useState(<></>);
    const [organModels, setOrganModels] = useState();
    const canvasRef = useRef(null);
    //I can use a global render later or delete idk
    const [renderer, setRenderer] = useState();
    const [mainCamera, setMainCamera] = useState();
    const [organMeshOpacity, setOrganMeshOpacity] = useState(.25);//placeholder for future use with an opacity slider
    const [rescalers, setRescalers] = useState();
    const [brushedOrganName, setBrushedOrganName] = useState();

    const manager = new THREE.LoadingManager();
    const loader = new VTKLoader(manager);
    const raycaster = new THREE.Raycaster();
    const materialArray = getMaterialArray();

    const maxNeighbors = 3;//limit the # of neighbors shown for now for performance

    useEffect(() => {
        if(!props.organData){return;}
        const organs = props.organData.organs;
        var meshes = {};
        for(let organ of organs){
            loader.load('models/' + organ + '.vtk', (geometry) => {
                geometry.computeVertexNormals();
                geometry.center();
                meshes[String(organ)] = geometry
            });
        }
        setOrganModels(meshes);
    },[props.organData]);

    useEffect(() => {
        if(!canvasRef.current){ return; }
        var h = canvasRef.current.clientHeight*.99;
        var w = canvasRef.current.clientWidth;
        var r = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        r.setClearColor(0x000000, 1);
        r.setPixelRatio(window.devicePixelRatio);
        r.sortObjects = true;
        r.setSize(w,h);
        setRenderer(r);
    },[canvasRef.current])

    useEffect(() => {
        if(!props.organData){return;}
        //get the extents for getting color scales
        const keys = ['mean_dose','volume'];//not including volume
        var scalers = {};
        var extents = {};
        for(let key of keys){
            if(key === 'volume'){
                extents.volume = {}
            } else{
                extents[key] = {
                    min: Number.POSITIVE_INFINITY,
                    max: Number.NEGATIVE_INFINITY
                }
            }
        }
        for(let [pId,pEntry] of Object.entries(props.organData.patients)){
            for(let [oName, oEntry] of Object.entries(pEntry)){
                for(let key of keys){
                    let val = oEntry[key];
                    //some values are negative?  This is probs a bug to fix
                    if(val === null || val === undefined || val <= 0){ continue; }
                    if(key === 'volume'){
                        let name = Utils.isTumor(oName)? 'GTV': oName
                        if(extents.volume[name] === undefined){
                            extents.volume[name] = {min: val, max: val}
                        } else{
                            extents.volume[name].min = Utils.min(extents.volume[name].min, val);
                            extents.volume[name].max = Utils.max(extents.volume[name].max, val) 
                        }
                    } else{
                        extents[key].min = Utils.min(extents[key].min, val);
                        extents[key].max = Utils.max(extents[key].max, val);
                    }
                }
            }
        }
        let temp = {}
        for(let [key, ex] of Object.entries(extents)){
            if(key ===  'volume'){
                scalers.volume = {};
                for(let [organ, ranges] of Object.entries(ex)){

                    let median = (ranges.max + ranges.min)/2;
                    let scale = function(d){ 
                        return d/median;
                    }
                    temp[organ] = [median,ranges.max,ranges.min]
                    scalers.volume[organ] = scale;
                }
            }else{
                //this is what determins the color ranges that goes ino 
                let range = [.5,1]
                let scale = d3.scaleLinear()
                    .domain([0, ex.max])
                    .range([0,1]);
                    scalers[key] = scale;
            }
        }
        setRescalers(scalers);
    },[props.organData])

    useEffect(() => {
        if(!renderer || !props.organData || !props.organClusters || !props.selectedPatient || !organModels || !rescalers){ return; }

        let pList = [{id: props.selectedPatient, similarity: 1}];
        let clusterData = props.organClusters.patients[props.selectedPatient];
        try{
            let neighbors = clusterData.neighbors;
            let sims = clusterData.similarity;
            let count = 0;
            for(let n of neighbors){
                if(count > maxNeighbors){break;}
                let obj = {id: n, similarity: sims[count]}
                pList.push(obj);
                count += 1
            }
        } catch{
            console.log('problem getting neighbors', props.organClusters.patients);
        }
        const cameraPositionZ = 500;

        const getOrganModel = function(organName, scale=1){
            if(Utils.isTumor(organName)){
                let model = new THREE.SphereGeometry(16,16);
                return model;
            }
            let model = organModels[organName];
            if(model === undefined){//check alternative organ names
                model = organModels[constants.ORGAN_NAME_MAP[organName]];
            }
            if(model !== undefined){
                model.name = organName + 'Geometry';
                return model.clone().scale(scale,scale,scale);
            } else{
                // console.log("missing organ model for", organName);
            }
            return;
        }

        let pViews = pList.map((obj,k) => {
            let id = obj.id;
            let pEntry = props.organData.patients[id+""]
            if(pEntry !== undefined){
                return(
                    <PatientPlot3D
                        className={'patientScene'}
                        key={k+'_'+id}
                        pId={id}
                        pData = {pEntry}
                        raycaster={raycaster}
                        materialArray={materialArray}
                        mainCamera={mainCamera}
                        similarity={obj.similarity}
                        cameraPositionZ={cameraPositionZ}
                        setMainCamera={setMainCamera}
                        getOrganModel={getOrganModel}
                        organMeshOpacity={organMeshOpacity}
                        active={props.selectedPatient === id}
                        rescalers={rescalers}
                        brushedOrganName={brushedOrganName}
                        setBrushedOrganName={setBrushedOrganName}
                    ></PatientPlot3D>
                )
            }
        })
        setPatientViews(pViews)
    }, [rescalers,props.selectedPatient,organModels,mainCamera,brushedOrganName,props.organClusters])

    return (
        <div ref={canvasRef} className={"col organViewCanvas"}>
        {patientViews}
        </div>
    )
}
