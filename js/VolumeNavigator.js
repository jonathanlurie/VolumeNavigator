/*
  Author: Jonathan Lurie
  Institution: McGill University, Montreal Neurological Institute - MCIN
  Date: started on Jully 2016
  email: lurie.jo2gmail.com
  License: MIT

  VolumeNavigator is originally a (fancy) widget for MincNavigator.
*/
var VolumeNavigator = function(outerBoxOptions, innerBoxOptions, divID){
  this.raycaster = new THREE.Raycaster();
  this.raycaster.linePrecision = 5;
  this.mouse = new THREE.Vector2();

  // relate to grabbing an object (circle helper or arrow)
  this.objectGrabed = {
    isGrabed: false,
    currentGrabPosition: new THREE.Vector3(),
    axis: [0, 0, 0], // each is a factor so should be 0 or 1
    translationOrRotation: 0, // 0:tranlation 1:rotation
    previousMouse: new THREE.Vector2()
  };

  this.outerBoxSize = outerBoxOptions;
  this.innerBoxSize = innerBoxOptions;
  this.domContainer = document.getElementById(divID);

  this.boxDiagonal = Math.sqrt(this.outerBoxSize.xSize * this.outerBoxSize.xSize +
      this.outerBoxSize.ySize * this.outerBoxSize.ySize +
      this.outerBoxSize.zSize * this.outerBoxSize.zSize);

  this.sceneOptions = {
      width: this.domContainer.clientWidth,
      height: this.domContainer.clientHeight,
      viewAngle: 45,
      near: 0.1,
      far: this.boxDiagonal * 20,

  };

  // plane equation as (ax + by + cz + d = 0)
  this.planeEquation = {
      a: 0,
      b: 0,
      c: 0,
      d: 0
  }

  // array of intersection points between the plane and the volume
  this.planePolygon = null;

  // array triangles
  this.polygonTriangles = null;

  // array of object (material, geometry, mesh).
  // Used to symbolize the intersections between the plane and the volume
  this.intersectionSpheres = [];

  // declaring it in advance allow to test its instanciation
  // contains the mesh, geometry and material of the plane
  this.plane = null;
  this.arrowHelper = null;

  // callback when a slider is moved (still mouse down)
  this.onChangeCallback = null;

  // callback when a slider has finished to slide (mouse up)
  this.onFinishChangeCallback = null;

  this.helpers = {
    polygonCenterArrows: [null, null, null],
    gimbal: null,
  };

  // Array containg each edge (12) equation in space
  this.cubeEdges = this._getEdgesEquations();

  this.vectorTools = new VectorTools();

  // initialize THREE js elements necessary to create and render a scene
  this.init();

  // build the box context
  this.buildInnerBox();
  this.buildOuterBox();
  this.buildPlane();
  this.initPolygonTriangles();

  // init click and keyboard events
  this.initKeyEvents();

  this.setupLighting();

  // initialize the UI (dat.gui)
  this.initGui();

  this.initKeyEvents();

  // just toi nitialize in order to update dat.gui field
  this.update();

  this.initGimbal();

  this.buildGuiButton("Toggle controls", this.AxisArrowHelperToggle.bind(this));

  // animate and update
  this.animate();
}



VolumeNavigator.prototype.initKeyEvents = function(){
  window.addEventListener( 'mousedown', this.onMouseDown.bind(this), false );
  window.addEventListener( 'mouseup', this.onMouseUp.bind(this), false );
  window.addEventListener( 'mousemove', this.onMouseMove.bind(this), false );

  window.addEventListener( 'keyup', this.onKeyDown.bind(this), false );
}


VolumeNavigator.prototype.onKeyDown = function(event){
  if(typeof this.lastKeyupTimestamp === 'undefined'){
    this.lastKeyupTimestamp = 0;
  }

  // we dont consider event that are to fast (prevent keyup from being triggerd twice)
  if(event.timeStamp - this.lastKeyupTimestamp < 100){
    return;
  }

  switch ( event.keyCode ) {
    // space bar
    case 32:
    event.preventDefault();
    event.stopPropagation();

    this.AxisArrowHelperToggle();
    break;

    default:

  }

  this.lastKeyupTimestamp = event.timeStamp;

}

/*
  The callback cb will be called when a slider from is moving
*/
VolumeNavigator.prototype.setOnChangeCallback = function(cb){
  this.onChangeCallback = cb;
}


/*
  The callback cb will be called when a slider from is done moving
*/
VolumeNavigator.prototype.setOnFinishChangeCallback = function(cb){
  this.onFinishChangeCallback = cb;
}


/*
    Create and initialize all the necessary to build a THREE scene
*/
VolumeNavigator.prototype.init = function(){
    // THREE.JS rendered
    this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });

    // THREE.JS camera
    this.camera = new THREE.PerspectiveCamera(
        this.sceneOptions.viewAngle,
        this.sceneOptions.width / this.sceneOptions.height,
        this.sceneOptions.near,
        this.sceneOptions.far
    );

    // THREE.JS orbit controls
    this.controls = new THREE.OrbitControls( this.camera, this.renderer.domElement );
    this.controls.target.fromArray([this.outerBoxSize.xSize / 2, this.outerBoxSize.ySize / 2, this.outerBoxSize.zSize / 2])

    // THREE.JS scene
    this.scene = new THREE.Scene();

    // add the camera to the scene
    this.scene.add(this.camera);

    // the camera starts at 0,0,0
    // so pull it back, in a more comfortable position
    this.camera.position.z = this.boxDiagonal * 2;
    this.camera.position.y = this.boxDiagonal * 1.5;
    this.camera.position.x = -this.boxDiagonal;

    // start the renderer
    this.renderer.setSize(this.sceneOptions.width, this.sceneOptions.height);

    // attach the render-supplied DOM element
    this.domContainer.appendChild(this.renderer.domElement);

    // add axis
    var axisHelper = new THREE.AxisHelper( this.boxDiagonal / 4 );
    this.scene.add( axisHelper );
}


/*
    Build the inner box (aka. brain within minc) ans displays it on the scene
*/
VolumeNavigator.prototype.buildInnerBox = function(){
    this.innerBox = {};

    this.innerBox.material = new THREE.MeshBasicMaterial({
        color: 0x7E2FB4,
        wireframe: true,

    });

    // geometry
    this.innerBox.geometry = new THREE.CubeGeometry(
        this.innerBoxSize.xSize,
        this.innerBoxSize.ySize,
        this.innerBoxSize.zSize
    );

    // the corner of the box is at the origin
    this.innerBox.geometry.translate(
        this.innerBoxSize.xSize / 2 + this.innerBoxSize.xOrigin,
        this.innerBoxSize.ySize / 2 + this.innerBoxSize.yOrigin,
        this.innerBoxSize.zSize / 2 + this.innerBoxSize.zOrigin
    );

    var innerBoxMesh = new THREE.Mesh( this.innerBox.geometry, this.innerBox.material )

    // add the inner box to scene
    //this.scene.add( innerBoxMesh );

    // adding the wireframe provide better understanding of the scene
    var helper = new THREE.EdgesHelper( innerBoxMesh, 0xDAB0F7 );
    this.scene.add( helper );

}


/*
    Build the inner box (aka. brain within minc) ans displays it on the scene
*/
VolumeNavigator.prototype.buildOuterBox = function(){

    this.outerBox = {};

    // material
    this.outerBox.material = new THREE.MeshLambertMaterial( {
        transparent: true,
        opacity: 0.8,
        color: 0xc489ed,
        emissive: 0x000000,
        depthWrite: true,
        depthTest: true,
        side: THREE.BackSide
    });

    // geometry
    this.outerBox.geometry = new THREE.CubeGeometry(
        this.outerBoxSize.xSize,
        this.outerBoxSize.ySize,
        this.outerBoxSize.zSize
    );

    // the corner of the box is at the origin
    this.outerBox.geometry.translate(
        this.outerBoxSize.xSize / 2,
        this.outerBoxSize.ySize / 2,
        this.outerBoxSize.zSize /2
    );

    // add the outer box to the scene
    this.scene.add( new THREE.Mesh( this.outerBox.geometry, this.outerBox.material ) );

}


/*
    Calls buildPlaneFromNormalAndPoint with default settings
*/
VolumeNavigator.prototype.buildPlane = function(){

  this.buildPlaneFromNormalAndPoint(
    [0, 0, 1],
    [
      this.outerBoxSize.xSize / 2,
      this.outerBoxSize.ySize / 2,
      this.outerBoxSize.zSize / 2
    ]
  );
}


/*
  rebuild a plane from scratch. May or may not overload the existing one
*/
VolumeNavigator.prototype.buildPlaneFromNormalAndPoint = function(vector, point){

  var p1 = new THREE.Vector3(point[0], point[1], point[2]);
  var n = new THREE.Vector3(vector[0], vector[1], vector[2]).normalize();
  var d = (-1) * (n.x * p1.x + n.y * p1.y + n.z * p1.z );

  // find another point on the plane...
  // The next 3 cases are for when a plane is (at least in one of the 3 dimensions)
  // aligned with the referential
  var p2 = null;

  // case 1
  if(n.z != 0){
    var x2 = p1.x + 1;
    var y2 = p1.y;
    var z2 = (-1) * ( (n.x * x2 + n.y * y2 + d) / n.z );
    p2 = new THREE.Vector3(x2, y2, z2);
  }

  // case 2
  if(n.y != 0 && !p2){
    var x2 = p1.x + 1;
    var z2 = p1.z;
    var y2 = (-1) * ( (n.x * x2 + n.z * z2 + d) / n.y );
    p2 = new THREE.Vector3(x2, y2, z2);
  }

  // case 3
  if(n.x != 0 && !p2){
    var y2 = p1.y + 1;
    var z2 = p1.z;
    var x2 =  (-1) * ( (n.y * y2 + n.z * z2 + d) / n.x );
    p2 = new THREE.Vector3(x2, y2, z2);
  }

  // in case of somthing wrong, we dont want to b
  if(!p2 || !p1)
    return;



  // unit vectors:
  var u = new THREE.Vector3().subVectors(p2, p1).normalize();
  var v = new THREE.Vector3().crossVectors(u, n).normalize();

  // remove the plane from the scene to RE-build it
  if(this.plane){
    //console.log("rebuild the plane");
    this.scene.remove( this.plane.mesh );
  }

  if(this.guiValue){
    this.guiValue.current.xTrans = point[0];
    this.guiValue.current.yTrans = point[1];
    this.guiValue.current.zTrans = point[2];

    this.guiValue.previous.xTrans = point[0];
    this.guiValue.previous.yTrans = point[1];
    this.guiValue.previous.zTrans = point[2];
  }


  // the square representing the plan has a side measuring this.boxDiagonal
  this.plane = {};

  // material
  this.plane.material = new THREE.MeshLambertMaterial( {
      transparent: true,
      opacity: 0.01,
      color: 0xFF0000,
      emissive: 0x000000,    // darkest color
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide,
  } );

  this.plane.geometry = new THREE.Geometry();

  var planeSideSize = 0.01; //this.boxDiagonal;
  //var planeSideSize = this.boxDiagonal;
  // vertice declaration
  // 0
  this.plane.geometry.vertices.push(
    new THREE.Vector3(
      -(planeSideSize/2) * u.x - (planeSideSize/2) * v.x,
      -(planeSideSize/2) * u.y - (planeSideSize/2) * v.y,
      -(planeSideSize/2) * u.z - (planeSideSize/2) * v.z
    ));

  // 1
  this.plane.geometry.vertices.push(
    new THREE.Vector3(
      (planeSideSize/2) * u.x - (planeSideSize/2) * v.x,
      (planeSideSize/2) * u.y - (planeSideSize/2) * v.y,
      (planeSideSize/2) * u.z - (planeSideSize/2) * v.z
    ));

  // 2
  this.plane.geometry.vertices.push(
    new THREE.Vector3(
      (planeSideSize/2) * u.x + (planeSideSize/2) * v.x,
      (planeSideSize/2) * u.y + (planeSideSize/2) * v.y,
      (planeSideSize/2) * u.z + (planeSideSize/2) * v.z
    ));

  // 3
  this.plane.geometry.vertices.push(
    new THREE.Vector3(
      -(planeSideSize/2) * u.x + (planeSideSize/2) * v.x,
      -(planeSideSize/2) * u.y + (planeSideSize/2) * v.y,
      -(planeSideSize/2) * u.z + (planeSideSize/2) * v.z
    ));

  // creation of triangles from existing vertice (using their index)
  this.plane.geometry.faces.push( new THREE.Face3( 0, 1, 2 ) );
  this.plane.geometry.faces.push( new THREE.Face3( 3, 0, 2 ) );

  // move the plane to the right place
  this.plane.geometry.translate(point[0], point[1], point[2]);

  this.plane.geometry.computeFaceNormals();
  this.plane.mesh = new THREE.Mesh( this.plane.geometry, this.plane.material );
  //this.plane.mesh.visible = false;
  this.scene.add( this.plane.mesh );
}


/*
    seting up both lights, ambient and point
*/
VolumeNavigator.prototype.setupLighting = function(){

    var ambientLight = new THREE.AmbientLight( 0xFFFFFF );
    this.scene.add( ambientLight );

    // create a point light
    var pointLight = new THREE.PointLight(0xFFFFFF);

    // set its position
    pointLight.position.x = this.boxDiagonal * 10;
    pointLight.position.y = this.boxDiagonal * 10;
    pointLight.position.z = this.boxDiagonal * 10;

    // add to the scene
    this.scene.add(pointLight);
}


/*
    Render the scene
*/
VolumeNavigator.prototype.render = function(){
  this.controls.update();
  this.renderer.render(this.scene, this.camera);
}


/*
    animate the scene
*/
VolumeNavigator.prototype.animate = function(){
    requestAnimationFrame(this.animate.bind(this));
    this.render();
}


/*
    Adds the settings available in dat.gui
*/
VolumeNavigator.prototype.initGui = function(){
    this.gui = new dat.GUI({ width: 400 });
    this.guiValue = {};

    this.guiValue.current = {
        xTrans: 0,
        yTrans: 0,
        zTrans: 0,
        xRot  : 0,
        yRot  : 0,
        zRot  : 0
    };

    // a backup so that we can make dif
    this.guiValue.previous = {
        xTrans: 0,
        yTrans: 0,
        zTrans: 0,
        xRot  : 0,
        yRot  : 0,
        zRot  : 0
    };

    this.guiValue.literalPlaneEquation = {
        literal: ""
    }

    this.guiValue.normalVector = {
        literal: ""
    }

    this.guiValue.point = {
        literal: ""
    }

    // used later but better to declare here to avoid resetting
    this.guiValue.customButton = {};
    this.guiValue.customList = {};

    var that = this;

    var planeInfoFolder = this.gui.addFolder('Plane information');
    planeInfoFolder.add(this.guiValue.literalPlaneEquation, 'literal').name("Plane equation").listen();
    planeInfoFolder.add(this.guiValue.normalVector, 'literal').name("Normal vector").listen();
    planeInfoFolder.add(this.guiValue.point, 'literal').name("Point").listen();

    // TRANSLATION
    var planeTransFolder = this.gui.addFolder('Plane translation');
    planeTransFolder.add(this.guiValue.current, "xTrans", -this.boxDiagonal*1., this.boxDiagonal*1., 1).name("x").listen()
        .onChange(function(value) {

            that.translatePlane([
              that.guiValue.previous.xTrans - that.guiValue.current.xTrans,
              that.guiValue.previous.yTrans - that.guiValue.current.yTrans,
              that.guiValue.previous.zTrans - that.guiValue.current.zTrans
            ]);

            that.guiValue.previous.xTrans = value;
            that.update();

            // calling the callback if defined
            if(that.onChangeCallback){
              that.onChangeCallback();
            }

        })
        .onFinishChange(function(value) {
          // calling the callback if defined
          if(that.onFinishChangeCallback){
            that.onFinishChangeCallback();
          }
        });

    planeTransFolder.add(this.guiValue.current, "yTrans", -this.boxDiagonal*1., this.boxDiagonal*1., 1).name("y").listen()
        .onChange(function(value) {
            that.translatePlane([
              that.guiValue.previous.xTrans - that.guiValue.current.xTrans,
              that.guiValue.previous.yTrans - that.guiValue.current.yTrans,
              that.guiValue.previous.zTrans - that.guiValue.current.zTrans
            ]);

            that.guiValue.previous.yTrans = value;
            that.update();

            // calling the callback if defined
            if(that.onChangeCallback){
              that.onChangeCallback();
            }
        })
        .onFinishChange(function(value) {
          // calling the callback if defined
          if(that.onFinishChangeCallback){
            that.onFinishChangeCallback();
          }
        });

    planeTransFolder.add(this.guiValue.current, "zTrans", -this.boxDiagonal*1., this.boxDiagonal*1., 1).name("z").listen()
        .onChange(function(value) {

            that.translatePlane([
              that.guiValue.previous.xTrans - that.guiValue.current.xTrans,
              that.guiValue.previous.yTrans - that.guiValue.current.yTrans,
              that.guiValue.previous.zTrans - that.guiValue.current.zTrans
            ]);

            that.guiValue.previous.zTrans = value;
            that.update();

            // calling the callback if defined
            if(that.onChangeCallback){
              that.onChangeCallback();
            }
        })
        .onFinishChange(function(value) {
          // calling the callback if defined
          if(that.onFinishChangeCallback){
            that.onFinishChangeCallback();
          }
        });

    // ROTATION
    var planeRotationFolder = this.gui.addFolder('Plane rotation');
    planeRotationFolder.add(this.guiValue.current, "xRot", -180, 180).name("x")
        .onChange(function(value) {
            dif = that.guiValue.previous.xRot - value;
            that.rotatePlaneDegree(dif, 0, 0);
            that.guiValue.previous.xRot = value;

            // calling the callback if defined
            if(that.onChangeCallback){
              that.onChangeCallback();
            }
        })
        .onFinishChange(function(value) {
          // calling the callback if defined
          if(that.onFinishChangeCallback){
            that.onFinishChangeCallback();
          }
        });

    planeRotationFolder.add(this.guiValue.current, "yRot", -180, 180, 1).name("y")
        .onChange(function(value) {
            dif = that.guiValue.previous.yRot - value;
            that.rotatePlaneDegree(0, dif, 0);
            that.guiValue.previous.yRot = value;

            // calling the callback if defined
            if(that.onChangeCallback){
              that.onChangeCallback();
            }
        })
        .onFinishChange(function(value) {
          // calling the callback if defined
          if(that.onFinishChangeCallback){
            that.onFinishChangeCallback();
          }
        });

    planeRotationFolder.add(this.guiValue.current, "zRot", -180, 180, 1).name("z")
        .onChange(function(value) {
            dif = that.guiValue.previous.zRot - value;
            that.rotatePlaneDegree(0, 0, dif);
            that.guiValue.previous.zRot = value;

            // calling the callback if defined
            if(that.onChangeCallback){
              that.onChangeCallback();
            }
        })
        .onFinishChange(function(value) {
          // calling the callback if defined
          if(that.onFinishChangeCallback){
            that.onFinishChangeCallback();
          }
        });


}


/*
  Add a button with its callback
*/
VolumeNavigator.prototype.buildGuiButton = function(name, callback){
  this.guiValue.customButton["name"] = name;
  this.guiValue.customButton["callback"] = callback;

  this.gui.add(this.guiValue.customButton, 'callback').name(this.guiValue.customButton.name);
}


/*
  Build the list of choice with a callback.
  args:
    listName: string - the name that will be displayed
    list: Array or Object (map) - the choices
    callback: function - function to call when a choice is done. It takes the value as argument.
*/
VolumeNavigator.prototype.buildGuiList = function(listName, list, callback){

  if(! (typeof this.guiValue.customList["controller"] === "undefined") ){
    // remove the current elem
    this.gui.remove(this.guiValue.customList["controller"]);
    this.guiValue.customList = {};
  }

  this.guiValue.customList["list"] = list;
  this.guiValue.customList["listName"] = listName;
  this.guiValue.customList["callback"] = callback;

  this.guiValue.customList["controller"] = this.gui.add(
    this.guiValue.customList,
    "listName",
    this.guiValue.customList["list"]
  )
  .name(this.guiValue.customList["listName"]) // necessay, I think there is a bug in using the name
  .onFinishChange(callback);

}


/*
  called when a slider is moved.
  Update few things: equation, normal, point, hitpoint
*/
VolumeNavigator.prototype.update = function(){
  //this.updatePlaneFromGimbalAndArrows();

  // update values related to plane equation, normal vector and plane point
  this.updatePlaneEquation();

  // compute the intersection points (aka. the intersection polygon)
  this.computeCubePlaneHitPoints();

  // Reorder the intersection polygon point cw to draw it easily
  this._orderPolygonPoints();

  // draw the intersection polygon
  this.updatePolygonTriangles();

  // draw a sphere at each vertex of the intersection polygon
  this.updateHitPointSpheres();
}


/*
    Updates the plane equation, based on three points of the plane
*/
VolumeNavigator.prototype.updatePlaneEquation = function(){

  var n = this.getPlaneNormal();
  var p = this.getPlanePoint();

  var eq = new THREE.Vector4(
      n[0],
      n[1],
      n[2],
      (-1) * (n[0]*p[0] + n[1]*p[1] + n[2]*p[2])
  );

  var roundFactor = 10000;

  this.planeEquation.a = Math.round(eq.x * roundFactor) / roundFactor;
  this.planeEquation.b = Math.round(eq.y * roundFactor) / roundFactor;
  this.planeEquation.c = Math.round(eq.z * roundFactor) / roundFactor;
  this.planeEquation.d = Math.round(eq.w * roundFactor) / roundFactor;

  // create a nice-to-display equation
  this.guiValue.literalPlaneEquation.literal =
      this.planeEquation.a + "x + " +
      this.planeEquation.b + "y + " +
      this.planeEquation.c + "z + " +
      this.planeEquation.d + " = 0";

  // Display/refresh the plane normal and the point

  var normalRounded = {
    x: Math.round(n[0] * roundFactor) / roundFactor,
    y: Math.round(n[1] * roundFactor) / roundFactor,
    z: Math.round(n[2] * roundFactor) / roundFactor
  };

  var pointRounded = {
    x: Math.round(p[0] * roundFactor) / roundFactor,
    y: Math.round(p[1] * roundFactor) / roundFactor,
    z: Math.round(p[2] * roundFactor) / roundFactor
  };

  this.guiValue.normalVector.literal = "(" + normalRounded.x + " ; " + normalRounded.y + " ; " + normalRounded.z + ")";

  this.guiValue.point.literal = "(" + pointRounded.x + " ; " + pointRounded.y + " ; " + pointRounded.z + ")";
}


/*
    return the plane equation as (ax + by + cz + d = 0).
*/
VolumeNavigator.prototype.getPlaneEquation = function(){
    return this.planeEquation;
}


/*
  get the normal vector of the plane as a array [x, y, z]
*/
VolumeNavigator.prototype.getPlaneNormal = function(){
  var normal = new THREE.Vector3();
  normal.copy(this.plane.geometry.faces[0].normal);
  normal.normalize();

  return [normal.x, normal.y, normal.z];
}


/*
  Get the center point of the plane as an array [x, y, z]
*/
VolumeNavigator.prototype.getPlanePoint = function(){
  return [
      (this.plane.geometry.vertices[0].x +
      this.plane.geometry.vertices[1].x +
      this.plane.geometry.vertices[2].x +
      this.plane.geometry.vertices[3].x) / 4. ,

      (this.plane.geometry.vertices[0].y +
      this.plane.geometry.vertices[1].y +
      this.plane.geometry.vertices[2].y +
      this.plane.geometry.vertices[3].y) / 4. ,

      (this.plane.geometry.vertices[0].z +
      this.plane.geometry.vertices[1].z +
      this.plane.geometry.vertices[2].z +
      this.plane.geometry.vertices[3].z)  / 4.
  ];
}


/*
  Define the center point of the red square (symbolizes a point of the plane).
  Along with setPlaneNormal(), it defines the plane equation.
  Args:
    p: Array [x, y, z] - the absolute position to reach
*/
VolumeNavigator.prototype.setPlanePoint = function(p){
  var currentPlanePoint = this.getPlanePoint();

  // Translate the plane to origin and then to p
  this.plane.geometry.translate(
      -currentPlanePoint[0] + p[0],
      -currentPlanePoint[1] + p[1],
      -currentPlanePoint[2] + p[2]
  );

  this.guiValue.current.xTrans = p[0];
  this.guiValue.current.yTrans = p[1];
  this.guiValue.current.zTrans = p[2];

  this.guiValue.previous.xTrans = p[0];
  this.guiValue.previous.yTrans = p[1];
  this.guiValue.previous.zTrans = p[2];

  // updating equation and its display on dat.gui
  this.update();

}


/*
  translate the plane (red square, possibly invisible)
*/
VolumeNavigator.prototype.translatePlane = function(delta){
  this.plane.geometry.translate(
      delta[0],
      delta[1],
      delta[2]
  );

  this.update();
}



/*
  Change the orientation of the plane so that its normal vector is v.
  The center of rotation is the center of the red square that represents the plane
  (not the origin)
  arg:
    vector: Array [x, y, z] - a normal vector (normalized or not)
*/
VolumeNavigator.prototype.setPlaneNormal = function(vector){

  var toLookAt = new THREE.Vector3(vector[0], vector[1], vector[2]);

  var currentCenter = {
     x: this.plane.geometry.boundingSphere.center.x,
     y: this.plane.geometry.boundingSphere.center.y,
     z: this.plane.geometry.boundingSphere.center.z
  }

  this.plane.geometry.translate(
     -currentCenter.x,
     -currentCenter.y,
     -currentCenter.z
  );

  this.plane.geometry.lookAt(toLookAt);

  this.plane.geometry.translate(
     currentCenter.x,
     currentCenter.y,
     currentCenter.z
  );

  this.update();
}


/*
  Rotate the plane (red square) using the center of the square as the center of rotation
  (and not the origin as it would do by default).
  args ax, ay and az are in degrees and can be 0.
  Note: the plane equation is updated in the end.
*/
VolumeNavigator.prototype.rotatePlaneDegree = function(ax, ay, az){

  var radx = ax * Math.PI / 180.
  var rady = ay * Math.PI / 180.
  var radz = az * Math.PI / 180.

  this.rotatePlaneRadian(radx, rady, radz);

}


/*
  Rotate the plane (red square) using the center of the square as the center of rotation
  (and not the origin as it would do by default).
  args ax, ay and az are in radians and can be 0.
  Note: the plane equation is updated in the end.
*/
VolumeNavigator.prototype.rotatePlaneRadian = function(ax, ay, az){
  var currentCenter = {
      x: this.plane.geometry.boundingSphere.center.x,
      y: this.plane.geometry.boundingSphere.center.y,
      z: this.plane.geometry.boundingSphere.center.z
  }

  this.plane.geometry.translate(
      -currentCenter.x,
      -currentCenter.y,
      -currentCenter.z
  );

  this.plane.geometry.rotateX(ax);
  this.plane.geometry.rotateY(ay);
  this.plane.geometry.rotateZ(az);

  this.plane.geometry.translate(
      currentCenter.x,
      currentCenter.y,
      currentCenter.z
  );

  this.update();
}


/*
  NOT USED
  This method computes the rotation matrix between the
  plane ZX and the oblique sclice. Translation from the origin is missing
  but since we actually don't needt this method, I stopped here.
*/
VolumeNavigator.prototype.getRotationMatrixSliceToZX = function(ax, ay, az){
  var n_zx = [0, 1, 0];
  var n_slice = this.getPlaneNormal();

  // cross product gives the normal to n_zx and n_slice and helps giving the sine.
  // In this matter, the normal vector is also the axis of rotation between n_zx and n_slice
  var u = this.vectorTool.crossProduct(n_zx, n_slice );
  var sinTheta = this.vectorTool.getNorm(u);
  var cosTheta = this.vectorTool.dotProduct(n_zx, n_slice);

  // we need u to be normalize to use it in the rotation matrix
  var uNorm = this.vectorTool.normalize(u);

  var rotationMatrix = [
    [cosTheta + uNorm[0]*uNorm[0]*(1-cosTheta)  , uNorm[0]*uNorm[1]*(1-cosTheta) - uNorm[2]*sinTheta, uNorm[0]*uNorm[2]*(1-cosTheta) + uNorm[1]*sinTheta],
    [uNorm[1]*uNorm[0]*(1-cosTheta) + uNorm[2]*sinTheta , cosTheta + uNorm[1]*uNorm[1]*(1-cosTheta), uNorm[1]*uNorm[2]*(1-cosTheta) - uNorm[0]*sinTheta],
    [uNorm[2]*uNorm[0]*(1-cosTheta) - uNorm[2]*sinTheta , uNorm[2]*uNorm[1]*(1-cosTheta) + uNorm[0]*sinTheta, cosTheta + uNorm[2]*uNorm[2]*(1-cosTheta)]
  ]

  var point = [50, 50, 50];
  var newPoint = this.vectorTool.rotate(point, rotationMatrix)


}


/*
  Build the edge equations (12 of them). Helpfull when dealing with hit points.
  (Dont call it at every refresh, they dont change!)
*/
VolumeNavigator.prototype._getEdgesEquations = function(){
  var xLength = this.outerBoxSize.xSize;
  var yLength = this.outerBoxSize.ySize;
  var zLength = this.outerBoxSize.zSize;
  var edgeData = [];

  // 0
  //vector:
  var edge0Vect = [xLength, 0, 0];
  var edge0Point = [0, 0, 0];

  // 1
  // vector:
  var edge1Vect = [0, yLength, 0];
  var edge1Point = [0, 0, 0];

  // 2
  // vector:
  var edge2Vect = [0, 0, zLength];
  var edge2Point = [0, 0, 0];

  // 3
  // vector:
  var edge3Vect = [0, 0, zLength];
  var edge3Point = [xLength, 0, 0];

  // 4
  // vector:
  var edge4Vect = [xLength, 0, 0];
  var edge4Point = [0, 0, zLength];

  // 5
  // vector:
  var edge5Vect = [xLength, 0, 0];
  var edge5Point = [0, yLength, 0];

  // 6
  // vector:
  var edge6Vect = [0, 0, zLength];
  var edge6Point = [0, yLength, 0];

  // 7
  // vector:
  var edge7Vect = [0, 0, zLength];
  var edge7Point = [xLength, yLength, 0];

  // 8
  // vector:
  var edge8Vect = [xLength, 0, 0];
  var edge8Point = [0, yLength, zLength];

  // 9
  // vector:
  var edge9Vect = [0, yLength, 0];
  var edge9Point = [0, 0, zLength];

  // 10
  // vector:
  var edge10Vect = [0, yLength, 0];
  var edge10Point = [xLength, 0, 0];

  // 11
  // vector:
  var edge11Vect = [0, yLength, 0];
  var edge11Point = [xLength, 0, zLength];

  edgeData.push( [edge0Vect, edge0Point] );
  edgeData.push( [edge1Vect, edge1Point] );
  edgeData.push( [edge2Vect, edge2Point] );
  edgeData.push( [edge3Vect, edge3Point] );
  edgeData.push( [edge4Vect, edge4Point] );
  edgeData.push( [edge5Vect, edge5Point] );
  edgeData.push( [edge6Vect, edge6Point] );
  edgeData.push( [edge7Vect, edge7Point] );
  edgeData.push( [edge8Vect, edge8Point] );
  edgeData.push( [edge9Vect, edge9Point] );
  edgeData.push( [edge10Vect, edge10Point] );
  edgeData.push( [edge11Vect, edge11Point] );

  return edgeData;
}


/*
  Hit points are the intersection point between the plane and the volume.
  Here, we decided to sho them so hit points are also hint points.
  They are updated as the plane moves, or at least it's how it looks like,
  they are actually replaced by new ones every time -- Since the number of
  hit point may vary (from 3 to 6), it's easier to create them as we know.
*/
VolumeNavigator.prototype.updateHitPointSpheres = function(){
  // removing the existing spheres from the scene
  for(var s=0; s<this.intersectionSpheres.length; s++){
    this.scene.remove(this.intersectionSpheres[s].mesh);
  }

  // if there is any...
  if(this.planePolygon){

    // reseting the array
    this.intersectionSpheres = [];

    for(var s=0; s<this.planePolygon.length; s++){

      var geometry = new THREE.SphereGeometry( this.boxDiagonal/100, 16, 16 );
      var material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
      var mesh = new THREE.Mesh( geometry, material );

      var currentSphere = {
        geometry: geometry,
        material: material,
        mesh: mesh
      }

      currentSphere.geometry.translate(
          this.planePolygon[s][0],
          this.planePolygon[s][1],
          this.planePolygon[s][2]
      );

      this.intersectionSpheres.push(currentSphere);
      this.scene.add( currentSphere.mesh );
    }
  }

}


/*
  Build the list of intersection point between the volume and the plane.
  Points stored in this.planePolygon
*/
VolumeNavigator.prototype.computeCubePlaneHitPoints = function(){
  var hitPoints = [];

  for(var i=0; i<this.cubeEdges.length; i++){
    var edge = this.cubeEdges[i];
    var tempHitPoint = this._getHitPoint(edge[0], edge[1]);

    // 1- We dont want to add infinite because it mean an orthogonal edge
    // from this one (still of the cube) will cross the plane in a single
    // point -- and this later case is easier to deal with.
    // 2- Check if hitpoint is within the cube.
    // 3- Avoid multiple occurence for the same hit point
    if( tempHitPoint && // may be null if contains Infinity as x, y or z
        this._isWithin(tempHitPoint))
    {
        var isAlreadyIn = false;

        // check if the point is already in the array
        for(var hp=0; hp<hitPoints.length; hp++ ){
          if( hitPoints[hp][0] == tempHitPoint[0] &&
              hitPoints[hp][1] == tempHitPoint[1] &&
              hitPoints[hp][2] == tempHitPoint[2]){
                isAlreadyIn = true;
                break;
              }
        }
        if(!isAlreadyIn){
          hitPoints.push(tempHitPoint);
        }
    }

  }

  // array are still easier to deal with
  this.planePolygon = hitPoints.length ? hitPoints : null;
}


/*
  Return true if the given point [x, y, z] is within the volume.
  (or on the edge)
*/
VolumeNavigator.prototype._isWithin = function(point){
  if(point[0] >=0 && point[0] <= this.outerBoxSize.xSize &&
     point[1] >=0 && point[1] <= this.outerBoxSize.ySize &&
     point[2] >=0 && point[2] <= this.outerBoxSize.zSize){

    return true;
  }else{
    return false;
  }
}


/*
  return a point in 3D space (tuple (x, y, z) ).
  vector and point define a "fixed vector" (droite affine)
  both are tuple (x, y, z)
  plane is the plane equation as a tuple (a, b, c, d)
*/
VolumeNavigator.prototype._getHitPoint = function(vector, point){

  // 3D affine system tuple:
  // ( (l, alpha), (m, beta), (n, gamma) )
  var affineSystem = this.vectorTools.affine3DFromVectorAndPoint(vector, point);

  // system resolution for t:
  // t = (a*l + b*m + c*n + d) / ( -1 * (a*alpha + b*beta + c*gamma) )

  var tNumerator = ( this.planeEquation.a* affineSystem[0][0] +
        this.planeEquation.b* affineSystem[1][0] +
        this.planeEquation.c* affineSystem[2][0] +
        this.planeEquation.d );

  var tDenominator = (-1) *
      ( this.planeEquation.a* affineSystem[0][1] +
        this.planeEquation.b* affineSystem[1][1] +
        this.planeEquation.c* affineSystem[2][1] );

  // TODO: be sure the cast to float is done
  // float conversion is mandatory to avoid euclidean div...
  //var t = float(tNumerator) / float(tDenominator);
  var t = tNumerator / tDenominator;

  // injection of t to the 3D affine system:
  var x =  affineSystem[0][0] + affineSystem[0][1] * t;
  var y =  affineSystem[1][0] + affineSystem[1][1] * t;
  var z =  affineSystem[2][0] + affineSystem[2][1] * t;

  // dont bother returning a vector containing Infinity, just return null.
  // (it will be spotted)
  if( x == Infinity ||
      y == Infinity ||
      z == Infinity)
  {
    return null;
  }

  // otherwise, return the 3D point
  return [x, y, z]
}



/*
  takes all the vertices of the intersection polygon and re-order the list so
  that the vertex are ordered cw
  (or ccw, we dont really care as long as it's no longer a mess)
*/
VolumeNavigator.prototype._orderPolygonPoints = function(){

  if(!this.planePolygon)
    return;

  var nbVertice = this.planePolygon.length;
  var center = this.getPolygonCenter();

  // create normailized vectors from center to each vertex of the polygon
  var normalizedRays = [];
  for(var v=0; v<nbVertice; v++){
    var currentRay = [
      center[0] - this.planePolygon[v][0],
      center[1] - this.planePolygon[v][1],
      center[2] - this.planePolygon[v][2]
    ];

    normalizedRays.push(this.vectorTools.normalize(currentRay));
  }

  // for each, we have .vertice (a [x, y, z] array) and .angle (rad angle to planePolygonWithAngles[0])
  var planePolygonWithAngles = [];

  // find the angle of each towards the first vertex
  planePolygonWithAngles.push({vertex: this.planePolygon[0], angle: 0})
  for(var v=1; v<nbVertice; v++){
    var cos = this.vectorTools.dotProduct(normalizedRays[0], normalizedRays[v]);
    var angle = Math.acos(cos);
    var currentPolygonNormal = this.vectorTools.crossProduct(normalizedRays[0], normalizedRays[v], false);
    var planeNormal = this.getPlaneNormal();
    var angleSign = this.vectorTools.dotProduct(currentPolygonNormal, planeNormal)>0? 1:-1;
    angle *= angleSign;

    planePolygonWithAngles.push({vertex: this.planePolygon[v], angle: angle})
  }

  // sort vertices based on their angle to [0]
  planePolygonWithAngles.sort(function(a, b){
    return a.angle - b.angle;
  });

  // make a array of vertex only (ordered)
  var orderedVertice = [];
  for(var v=0; v<nbVertice; v++){
    orderedVertice.push(planePolygonWithAngles[v].vertex);
  }

  // attribute the ordered array to this.planePolygo
  this.planePolygon = orderedVertice;
}


/*
  return the 3D center of the polygon.
  (Note: the polygon is formed by the intersection of the plane and the cube).
  Return: [x, y, z] Array
*/
VolumeNavigator.prototype.getPolygonCenter = function(){
  if(!this.planePolygon)
    return;

  var nbVertice = this.planePolygon.length;

  // find the center of the polygon
  var xAvg = 0;
  var yAvg = 0;
  var zAvg = 0;

  for(var v=0; v<nbVertice; v++){
    xAvg += this.planePolygon[v][0];
    yAvg += this.planePolygon[v][1];
    zAvg += this.planePolygon[v][2];
  }

  xAvg /= nbVertice;
  yAvg /= nbVertice;
  zAvg /= nbVertice;
  var center = [xAvg, yAvg, zAvg];

  return center;
}


/*
  initialize the intersection polygon (made out of triangles)
*/
VolumeNavigator.prototype.initPolygonTriangles = function(){
  this.polygonTriangles = {};
  this.polygonTriangles.geometry = new THREE.Geometry();
  this.polygonTriangles.geometry.dynamic = true;

  this.polygonTriangles.material = new THREE.MeshBasicMaterial( {
    //map: texture, //THREE.ImageUtils.loadTexture('textures/texture-atlas.jpg'),
    side: THREE.DoubleSide,
    color: 0xffffff,
    transparent: true,
    opacity: 0.8
  });

  this.polygonTriangles.mesh = new THREE.Mesh( this.polygonTriangles.geometry, this.polygonTriangles.material );
  this.scene.add( this.polygonTriangles.mesh );
}


/*
  Update the bunch of triangles that shape the intersection polygon.
  Since webGl does not play well with size-changing buffer, it basically
  consist in re-creating all the triangles from scratch...
*/
VolumeNavigator.prototype.updatePolygonTriangles = function(){

  // there is no polygon to display
  if(!this.planePolygon)
    return;

  // there is a polygon intersection to display..

  // remove all existing triangles
  this.polygonTriangles.geometry.faces = [];
  this.polygonTriangles.geometry.vertices = [];

  // remove and rebuild (since we cannot change buffer size in webGL)
  this.scene.remove( this.polygonTriangles.mesh );
  this.initPolygonTriangles();
  var center = this.getPolygonCenter();

  // add the center to the geom
  this.polygonTriangles.geometry.vertices.push(
    new THREE.Vector3( center[0], center[1], center[2])
  );

  // add all the vertice to the geom
  for(v=0; v<this.planePolygon.length; v++){

    this.polygonTriangles.geometry.vertices.push(
      new THREE.Vector3(
        this.planePolygon[v][0],
        this.planePolygon[v][1],
        this.planePolygon[v][2]
      ));
  }

  // shaping the faces out of the vertice
  for(v=0; v<this.planePolygon.length - 1; v++){
    this.polygonTriangles.geometry.faces.push( new THREE.Face3( 0, v+1, v+2 ) );
  }

  // adding the last face manually (to close the loop)
  this.polygonTriangles.geometry.faces.push( new THREE.Face3( 0, this.planePolygon.length, 1 ) );

  // it was removed earlier
  this.scene.add( this.polygonTriangles.mesh );


}


/*
  return a copy of this.planePolygon
*/
VolumeNavigator.prototype.getPlanePolygon = function(){
  return this.planePolygon.slice();
}


/*
  Load a texture from a canvas onto the section polygon using a "star pattern"
  --> using the center of the polygon as the common vertex for every triangle that
  compose the polygon.
  args:
    canvasID: string - the id of the html5 canvas we want to use the content from.
    coordinates: array of [x, y] - each [x, y] are the vertex as represented in the
      2D image, but they are in the ThreeJS convention (percentage + origin at bottom-left)

    We must have as many [x, y] couples in coordinates as there is faces declared in
    this.polygonTriangles.geometry.faces.

    In addition, the coord couples from coordinates must be in the same order as the
    faces from this.polygonTriangles.geometry.faces were declared
    (this dirty sorting job is not supposed to be done here!)
*/
VolumeNavigator.prototype.mapTextureFromCanvas = function(canvasID, coordinates){
  var numOfVertice = coordinates.length;

  // getting the center in the texture system (percentage + orig at bottom left)
  var coordCenter = [0, 0];

  for(var v=0; v<numOfVertice; v++){
    coordCenter[0] += coordinates[v][0];
    coordCenter[1] += coordinates[v][1];
  }

  coordCenter[0] /= numOfVertice;
  coordCenter[1] /= numOfVertice;

  // those triangles are percent coord that will match each face.
  var mappingTriangles = [];

  for(var v=0; v<numOfVertice - 1; v++){
    mappingTriangles.push(
      [
        new THREE.Vector2(coordCenter[0], coordCenter[1]), // C
        new THREE.Vector2(coordinates[v][0], coordinates[v][1]), // A
        new THREE.Vector2(coordinates[v+1][0], coordinates[v+1][1]) // B
      ]
    );
  }

  // adding the last triangle to close the loop
  mappingTriangles.push(
    [
      new THREE.Vector2(coordCenter[0], coordCenter[1]), // C
      new THREE.Vector2(coordinates[numOfVertice-1][0], coordinates[numOfVertice-1][1]), // A
      new THREE.Vector2(coordinates[0][0], coordinates[0][1]) // B
    ]
  );


  // clearing out any existing UV mapping
  this.polygonTriangles.geometry.faceVertexUvs[0] = [];

  // mapping the UV within the geometry
  for(var v=0; v<numOfVertice; v++){
    this.polygonTriangles.geometry.faceVertexUvs[0].push(
      [
        mappingTriangles[v][0],
        mappingTriangles[v][1],
        mappingTriangles[v][2]
      ]
    );
  }

  // loading the texture
  var canvas = document.getElementById(canvasID);
  var texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  this.polygonTriangles.material.map = texture;
  this.polygonTriangles.geometry.uvsNeedUpdate = true;

}


VolumeNavigator.prototype.initGimbal = function(){

  // if no polygon, no draw
  if(!this.planePolygon)
    return;

  var center = this.getPolygonCenter()
  var origin = new THREE.Vector3( center[0], center[1], center[2] );

  var length = this.boxDiagonal / 10;
  var headLength = length * 0.8;
  var headWidth =  length * 0.6;

  var xColor = 0xff3333;
  var yColor = 0x00ff55;
  var zColor = 0x0088ff;

  /*
  // ARROW HELPER - TRANSLATION
  var xDir = new THREE.Vector3( 1, 0, 0 );
  var yDir = new THREE.Vector3( 0, 1, 0 );
  var zDir = new THREE.Vector3( 0, 0, 1 );

  this.helpers.polygonCenterArrows[0] = new THREE.ArrowHelper( xDir, origin, length, xColor, headLength, headWidth );
  //this.helpers.polygonCenterArrows[0].setLength (length, length/4, length/5);
  this.helpers.polygonCenterArrows[1] = new THREE.ArrowHelper( yDir, origin, length, yColor, headLength, headWidth );
  //this.helpers.polygonCenterArrows[1].setLength (length, length/4, length/5);
  this.helpers.polygonCenterArrows[2] = new THREE.ArrowHelper( zDir, origin, length, zColor, headLength, headWidth );
  //this.helpers.polygonCenterArrows[2].setLength (length, length/4, length/5);

  this.scene.add( this.helpers.polygonCenterArrows[0] );
  this.scene.add( this.helpers.polygonCenterArrows[1] );
  this.scene.add( this.helpers.polygonCenterArrows[2] );
  */




  // CIRCLE HELPERS - ROTATION
  var geometryX = new THREE.CircleGeometry( this.boxDiagonal / 2, 64 );
  var geometryY = new THREE.CircleGeometry( this.boxDiagonal / 2, 64 );
  var geometryZ = new THREE.CircleGeometry( this.boxDiagonal / 2, 64 );
  var materialX = new THREE.LineBasicMaterial( { color: xColor, linewidth:1.5 } );
  var materialY = new THREE.LineBasicMaterial( { color: yColor, linewidth:1.5 } );
  var materialZ = new THREE.LineBasicMaterial( { color: zColor, linewidth:1.5 } );
  // remove inner vertice
  geometryX.vertices.shift();
  geometryY.vertices.shift();
  geometryZ.vertices.shift();

  // X circle
  var circleX = new THREE.Line( geometryX, materialX );
  circleX.name = "xCircle";
  geometryX.rotateY(Math.PI / 2)
  // Y circle
  var circleY = new THREE.Line( geometryY, materialY );
  circleY.name = "yCircle";
  geometryY.rotateX(-Math.PI / 2)
  // Z circle
  var circleZ = new THREE.Line( geometryZ, materialZ );
  circleZ.name = "zCircle";

  this.helpers.gimbal = new THREE.Object3D();
  this.helpers.gimbal.add(circleX);
  this.helpers.gimbal.add(circleY);
  this.helpers.gimbal.add(circleZ);

  // DOUBLE SIDE ARROW
  var normalVectorArrow = new THREE.Vector3().copy(circleZ.geometry.faces[0].normal);
  var normalArrow = new THREE.ArrowHelper(
    normalVectorArrow ,
    new THREE.Vector3(0, 0, 0),
    length,
    0x12C9BD,
    headLength,
    headWidth
  );
  normalArrow.name = "normalArrow";
  // renaming the child because it's with them we will intersect
  normalArrow.cone.name = "normalArrow";
  normalArrow.line.name = "normalArrow";


  var normalReverseVectorArrow = new THREE.Vector3().copy(normalVectorArrow).negate();
  var normalReverseArrow = new THREE.ArrowHelper(
    normalReverseVectorArrow ,
    new THREE.Vector3(0, 0, 0),
    length,
    0xFCC200,
    headLength,
    headWidth
  );
  normalReverseArrow.name = "normalArrow";
  // renaming the child because it's with them we will intersect
  normalReverseArrow.cone.name = "normalArrow";
  normalReverseArrow.line.name = "normalArrow";

  console.log(normalReverseArrow);

  this.helpers.gimbal.add(normalArrow);
  this.helpers.gimbal.add(normalReverseArrow);


  this.helpers.gimbal.translateOnAxis(origin.normalize(),  this.boxDiagonal / 2 );
  this.scene.add( this.helpers.gimbal );

}


/*
  Hide or show the axis arrow helper
*/
VolumeNavigator.prototype.AxisArrowHelperToggle = function(){
  this.helpers.gimbal.visible = !this.helpers.gimbal.visible;
}


/*
  return true is the mouse pointer is currently within the canvas,
  return false if outside.
*/
VolumeNavigator.prototype.isMouseWithinCanvas = function(event){
  var scrollTop = window.pageYOffset || (document.documentElement || document.body.parentNode || document.body).scrollTop;

  if(event.clientX > this.domContainer.offsetLeft &&
    event.clientX < this.domContainer.offsetLeft + this.domContainer.offsetWidth &&
    event.clientY > this.domContainer.offsetTop  - scrollTop &&
    event.clientY < this.domContainer.offsetTop + this.domContainer.offsetHeight
    ){

    return true;
  }else{
    return false;
  }
}


/*
  Update the mouse position with x and y in [-1; 1]
*/
VolumeNavigator.prototype.updateMousePosition = function(event){
  var scrollTop = window.pageYOffset || (document.documentElement || document.body.parentNode || document.body).scrollTop;

  this.mouse.x = ( (event.clientX - this.domContainer.offsetLeft) / this.domContainer.offsetWidth ) * 2 - 1;
  this.mouse.y = - ( (event.clientY - this.domContainer.offsetTop + scrollTop) / this.domContainer.offsetHeight ) * 2 + 1;
}


/*
  Callback to perform when to mouse clicks
*/
VolumeNavigator.prototype.onMouseDown = function(event){

  if(this.isMouseWithinCanvas(event)){

    this.updateMousePosition(event);
    this.updateAxisRaycaster();
  }

}


/*
  callback to perform when the mouse does not click anymore (release)
*/
VolumeNavigator.prototype.onMouseUp = function(event){
  var endGrabPosition = new THREE.Vector3(this.mouse.x, this.mouse.y, 1);
  endGrabPosition.unproject(this.camera);

  if(this.objectGrabed.isGrabed){
    // restore the view we had before grabbing axis arrows (should not be necessary but I suspect a bug in OrbitControlJS)
    this.restoreOrbitData();

    this.objectGrabed.isGrabed = false;
    // disable the controls
    this.controls.enabled = true;

    this.placeGimbalAtPolygonCenter();

    if(this.onFinishChangeCallback){
      this.onFinishChangeCallback();
    }
  }

}


/*
  Callback when the mouse moves
*/
VolumeNavigator.prototype.onMouseMove = function(event){
  // if no object is grabbed, we dont do anything
  if(!this.objectGrabed.isGrabed){
    return;
  }

  if(this.isMouseWithinCanvas(event)){
    this.updateMousePosition(event);

    // Mouse is supposed to have moved but sometimes the values are the same...
    if(this.objectGrabed.previousMouse.x == this.mouse.x &&
       this.objectGrabed.previousMouse.y == this.mouse.y){
      return;
    }

    // Tranlation or rotation?
    switch (this.objectGrabed.translationOrRotation) {
      // this is a tranlation...
      case 0:
        this.mouseMoveTranslation();
        break;

      // this is a rotation...
      case 1:
        this.mouseMoveRotation();
        break;
      default:

    }


    this.update();
    this.objectGrabed.previousMouse.copy(this.mouse);

    if(this.onChangeCallback){
      this.onChangeCallback();
    }

  }
}


/*
  called by onMouseMove when we are dealing with a rotation
*/
VolumeNavigator.prototype.mouseMoveTranslation = function(event){
  var center = this.getGimbalCenter();

  // get the helper origin in 2D [-1, 1] range
  var gimbalCenter2D = this.getScreenCoord(center, true);

  // the dir vector is the normal to the plane or its opposite
  var normal = this.getGimbalNormalVector(2);

  // projecting the directional vector in 2D (from the center), to get a 2D vector
  var topPoint = [
    center[0] + normal.x,
    center[1] + normal.y,
    center[2] + normal.z
  ]

  var topPoint2D = this.getScreenCoord(topPoint, true);

  var directionalVector2D = [
    topPoint2D[0] - gimbalCenter2D[0],
    topPoint2D[1] - gimbalCenter2D[1],
    topPoint2D[2] - gimbalCenter2D[2]
  ];
  var directionalVector2D_normalized = this.vectorTools.normalize(directionalVector2D);

  // vector
  var mouseVector = [
    this.mouse.x - this.objectGrabed.previousMouse.x,
    this.mouse.y - this.objectGrabed.previousMouse.y,
    0
  ];

  var mouseVector_normalize = this.vectorTools.normalize(mouseVector);

  var dotProd = this.vectorTools.dotProduct(
    directionalVector2D_normalized,
    mouseVector_normalize
  );

  var distance = ( this.vectorTools.getNorm(mouseVector) / this.vectorTools.getNorm(directionalVector2D) ) * dotProd;

  // here we have to use the relative normal vector of the gimbal
  // before it was rotated with quaternions (this is simply (0, 0, 1) )
  var gimbalRelativeNormal = this.helpers.gimbal.children[2].geometry.faces[0].normal;
  this.helpers.gimbal.translateOnAxis( gimbalRelativeNormal,distance );

  this.updatePlaneFromGimbalAndArrows();
}


/*
  called by onMouseMove when we are dealing with a rotation
*/
VolumeNavigator.prototype.mouseMoveRotation = function(event){

  // get the helper origin in 2D [-1, 1] range
  var gimbalCenter2D = this.getScreenCoord(this.getGimbalCenter(), true);

  // angle previousPos -> center -> newPos
  var angle = this.vectorTools.getAnglePoints(
    [this.objectGrabed.previousMouse.x, this.objectGrabed.previousMouse.y, 0],
    gimbalCenter2D,
    [this.mouse.x, this.mouse.y, 0]
  );

  // v1 goes from center to previous mouse pos
  var v1 = [
    this.objectGrabed.previousMouse.x - gimbalCenter2D[0],
    this.objectGrabed.previousMouse.y - gimbalCenter2D[1],
    0
  ];

  // v2 goes from center to current mouse pos
  var v2 = [
    this.mouse.x - gimbalCenter2D[0],
    this.mouse.y - gimbalCenter2D[1],
    0
  ];

  var crossP = this.vectorTools.crossProduct(v2, v1, true);

  // vector from camera to gimbal center
  var cameraToGimbal = new THREE.Vector3().subVectors(
    this.helpers.gimbal.position,
    this.camera.position
  ).normalize();

  var axisIndex = this.objectGrabed.axis.indexOf(1);

  var normalVector = this.getGimbalNormalVector(axisIndex);
  var dotProd = normalVector.dot(cameraToGimbal);


  // the finale angle is the angle but with a decision over the sign of it
  var finalAngle = angle * crossP[2] * (dotProd>0?1:-1);

  this.rotateGimbal(finalAngle, axisIndex);
}


/*
  return the normal vector of one of the disc that compose the gimbal.
  The hardcoded normal vector does not take into consideration the rotation
  of the gimbal, thus we need a method for that. (returns a copy)
*/
VolumeNavigator.prototype.getGimbalNormalVector = function(axis){
  var circleQuaternion = new THREE.Quaternion().copy(this.helpers.gimbal.quaternion);
  var normalVector = new THREE.Vector3()
    .copy(this.helpers.gimbal.children[axis].geometry.faces[0].normal);

  normalVector.applyQuaternion(circleQuaternion).normalize();

  return normalVector;
}


/*
  Called by a mouseDown event. Launch a raycaster to each arrow axis helper (the one used for translating the plane)
*/
VolumeNavigator.prototype.updateAxisRaycaster = function(){
  // if the axis helper are hidden, we dont go further
  if(!this.helpers.gimbal.visible){
    return;
  }

  // update the picking ray with the camera and mouse position
	this.raycaster.setFromCamera( this.mouse, this.camera );
  var hit = false;

  // intersection with a circle? (for rotation)
  var gimbalIntersections = this.raycaster.intersectObjects(this.helpers.gimbal.children, true );

  if(gimbalIntersections.length){

    this.objectGrabed.currentGrabPosition.copy(gimbalIntersections[0].point);
    hit = true;
    var objectName = gimbalIntersections[0].object.name;

    if(objectName == "xCircle"){
      this.objectGrabed.axis = [1, 0, 0];
      this.objectGrabed.translationOrRotation = 1;
    }else if (objectName == "yCircle"){
      this.objectGrabed.axis = [0, 1, 0];
      this.objectGrabed.translationOrRotation = 1;
    }else if (objectName == "zCircle"){
      this.objectGrabed.axis = [0, 0, 1];
      this.objectGrabed.translationOrRotation = 1;
    }else if (objectName == "normalArrow"){
      this.objectGrabed.translationOrRotation = 0;
    }

  }



  // in any case of hit...
  if(hit){

    this.objectGrabed.previousMouse.copy(this.mouse);
    this.objectGrabed.isGrabed = true;
    this.controls.enabled = false;
    this.saveOrbitData();
  }

}


/*
  save the OrbitControl setting to be able to restore this exact view later
*/
VolumeNavigator.prototype.saveOrbitData = function(){
  this.orbitData = {
    target: new THREE.Vector3(),
    position: new THREE.Vector3(),
    zoom: this.controls.object.zoom
  }

  this.orbitData.target.copy(this.controls.target);
  this.orbitData.position.copy(this.controls.object.position);
}


/*
  Restore the viez that was saved before
*/
VolumeNavigator.prototype.restoreOrbitData = function(){
  this.controls.position0.copy(this.orbitData.position);
  this.controls.target0.copy(this.orbitData.target);
  this.controls.zoom0 = this.orbitData.zoom;
  this.controls.reset();
}


/*
  axis is 0 for x, 1 for y and 2 for z
*/
VolumeNavigator.prototype.rotateGimbal = function(angle, axis){
  var circleObject = this.helpers.gimbal.children[ axis ];

  // the rotation axis we want is the normal of the disk
  // the NoRot vector is the normal vector before the group was rotated
  var normalVectorNoRot = new THREE.Vector3().copy(circleObject.geometry.faces[0].normal);

  // the metods rotateOnAxis takes in consideration the internal quaternion
  // (no need to tune that manually, like I was trying to...)
  this.helpers.gimbal.rotateOnAxis( normalVectorNoRot, angle );

  // rotate the plane accordingly
  this.updatePlaneFromGimbalAndArrows();
}


/*
  return the center of the arrow helper system,
  which is also the center of the gimbal
*/
VolumeNavigator.prototype.getGimbalCenter = function(){
  var center = this.helpers.gimbal.position;

  return [
    center.x,
    center.y,
    center.z
  ];
}


/*
  update the main plane (red square) with the center and
  the normal vector of the gimbal.
*/
VolumeNavigator.prototype.updatePlaneFromGimbalAndArrows = function(){
  var normal = this.getGimbalNormalVector(2);
  var center = this.getGimbalCenter();
  this.buildPlaneFromNormalAndPoint([normal.x, normal.y, normal.z], center);
}


/*
  moves the helper centers to the center of the polygon
  (called at mouseup)
*/
VolumeNavigator.prototype.placeGimbalAtPolygonCenter = function(){
  if(!this.helpers.gimbal)
    return;

  var polygonCenter = this.getPolygonCenter();

  // update circle helper position
  this.helpers.gimbal.position.x = polygonCenter[0];
  this.helpers.gimbal.position.y = polygonCenter[1];
  this.helpers.gimbal.position.z = polygonCenter[2];
}


/*
  return the screen coord [x, y]
  args:
    coord3D: Array [x, y, z] - the 3D coodinate to convert
    normalized: bool - when true, x and y are within [-1, 1]
      if false, they are in pixel (ie. x[0, 800] and y[0, 600])
*/
VolumeNavigator.prototype.getScreenCoord = function(coord3D, normalized){

  var width = this.domContainer.offsetWidth;
  var height = this.domContainer.offsetHeight;

  var vector = new THREE.Vector3();
  vector.set( coord3D[0], coord3D[1], coord3D[2] );

  // map to normalized device coordinate (NDC) space
  vector.project( this.camera );

  if(!normalized){
    // map to 2D screen space
    vector.x = (   vector.x + 1 ) * (width  / 2 );
    vector.y = ( - vector.y + 1 ) * (height / 2 );
    vector.z = 0;
  }

  return [vector.x, vector.y, 0];
}
