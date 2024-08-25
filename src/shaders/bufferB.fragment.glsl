@nomangle GRID_HEIGHT GRID_WIDTH NUM_CAPSULES iMouse texture
#version 300 es
precision highp float;
uniform sampler2D iChannel0;  // Input from Common
uniform sampler2D iChannel1;  // Input from text atlas
uniform vec2 resolution;
uniform vec4 iMouse;
uniform vec3 iMouseMove;
out vec4 fragColor;
uniform float iTime; 
uniform float u_super;
uniform float u_superAvailable;
uniform float u_gameStarted;
uniform mat4 u_boxes[13];

const float PI = 3.14159265359;
// ${commonShaderSrc} 

float sdCircle(vec2 p, vec2 c, float r) {
    return distance(p, c) - r;
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 ap = p - a;
    vec2 ab = b - a;
    return distance(ap, ab * clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0));
}

float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

float sdOne(vec2 p) {
    vec2 a = vec2(100.0, 150.0);  // Start of the "1" segment in pixels
    vec2 b = vec2(100.0, 350.0);  // End of the "1" segment in pixels
    float r = 20.0;               // Thickness of the "1" in pixels
    float dist = sdCapsule(p, a, b, r);
    // if (dist < 0.0) {
    //     return -1.0;
    // } else {
    //   return dist;
    // }
    return dist;

    // return sdCapsule(p, a, b, r);
}

float sdSquare(vec2 p, vec2 center, vec2 size) {
    vec2 d = abs(p - center) - size;
    return max(d.x, d.y);
}
    
float sdCapsuleFixed(vec2 p, vec2 pos, float len, float rot, float r) {
  vec2 ba = vec2(sin(rot), cos(rot)) * len; // default orientation is vertical
  vec2 pa = p - pos + ba; // top center

  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// Function to rotate a point around the origin
vec2 rotate(vec2 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Main SDF function for the stickman, applying hierarchical transformations
float sdStickman2(vec2 p, vec2 pos, float headLen, float rot, float super, float magnitude) {
    // Rotate and translate point p into head's local coordinate space
    vec2 localP = rotate(p - pos, rot + 0.01 * cos(20.0*iTime));
    float time = mod(iTime,2.0*PI);
    // Head - no need to translate or rotate further as it is the root
    float head = sdCapsuleFixed(localP, vec2(0,0), headLen, 0.0, 15.0);

    // Body - positioned just below the head
    float bodyLen = headLen * 2.3;
    vec2 bodyPos = vec2(0, -headLen - 30.0); // local relative position
    float body = sdCapsuleFixed(localP, bodyPos, bodyLen, 0.0, 10.0 + sin(30.0*max(magnitude, 0.1)*time)*0.3);

    // Legs
    float legLength = bodyLen * 0.75;
    float leg1 = sdCapsuleFixed(localP, bodyPos - vec2(0.13 * bodyLen, 53.0), legLength, 0.5 - 0.3*super + cos(60.0*magnitude*time)*0.1 - min(magnitude*50.0, 0.4), 5.0);
    float leg2 = sdCapsuleFixed(localP, bodyPos - vec2(-0.13 * bodyLen, 53.0), legLength, -0.5 + 0.3*super - sin(60.0*magnitude*time)*0.1 + min(magnitude*50.0, 0.4), 5.0);

    // Arms
    float armLength = bodyLen * 0.75;
    float arm1 = sdCapsuleFixed(localP, bodyPos + vec2(0.2 * bodyLen, 0.0 * bodyLen), armLength, -0.5 - 2.1*super + cos(60.0*magnitude*time)*0.1 + min(magnitude*50.0, 0.2), 5.0);
    float arm2 = sdCapsuleFixed(localP, bodyPos + vec2(-0.2 * bodyLen, 0.0 * bodyLen), armLength, 0.5 + 2.1*super + sin(60.0*magnitude*time)*0.1 - min(magnitude*50.0, 0.2), 5.0);

    // Combine all distances using the min function
    return min(min(min(head, body), min(leg1, leg2)), min(arm1, arm2));
}

float sdBox(vec2 p, vec2 b )
{
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

vec2 gridOffset(vec2 uv, float index) {
    vec2 gridSize = vec2(5.0, 5.0);  // 5x5 grid
    vec2 cellSize = 1.0 / gridSize;   // Size of each cell
    float col = mod(index, gridSize.x);
    float row = floor(index / gridSize.x);
    vec2 cellPos = vec2(col, row) * cellSize;  // Position of the cell
    return (uv - cellPos) / cellSize - 0.5;  // Normalize UV to cell space
}

float digit0(vec2 p, float scale) {
  // Circle
  float d = length(p) - 0.9 * scale;
  return d;
}

float digit1(vec2 p, float scale) {
  float d = sdCapsuleFixed(p, vec2(0.0, 0.7) * scale, 1.4 * scale, 0.0, 0.2 * scale);
    d = min(d, sdCapsuleFixed(p, vec2(0.0, 0.7) * scale, 0.5 * scale, 1.0, 0.2 * scale));
    return d;
}

float digit2(vec2 p, float scale) {
    // draw border with size of 1
//   float scale = 100.0;
  float d = sdCapsuleFixed(p, vec2(0.3, 0.5) * scale, 0.6 * scale, PI/2.0, 0.3 * scale);
  d = min(d, sdCapsuleFixed(p, vec2(0.3, -0.5) * scale, 0.6 * scale, PI/2.0, 0.3 * scale));

  return d;
}

// Construct using sdCapsule, like in LED, digit2
float digit3(vec2 p, float scale) {
//   float scale = 100.0;
  float d = sdCapsuleFixed(p, vec2(0.6, 0.6) * scale, 1.1 * scale, PI/2.0, 0.2 * scale);
  d = min(d, sdCapsuleFixed(p, vec2(0.6, 0.0) * scale, 0.4 * scale, PI/2.0, 0.2 * scale));
  // d = min(d, sdCapsuleFixed(p, vec2(-0.3, -0.2) * scale, 0.8, 0.0));
  d = min(d, sdCapsuleFixed(p, vec2(0.6, -0.6) * scale, 1.1 * scale, PI/2.0, 0.2 * scale));
  // d = min(d, sdCapsuleFixed(p, vec2(-0.3, -0.9) * scale, 0.8, 0.0));
  return d;
}

float digit4(vec2 p, float scale) {
  float d = sdCapsuleFixed(p, vec2(0.6, -0.05) * scale, 1.2 * scale, PI/2.0, 0.2 * scale);
  d = min(d, sdCapsuleFixed(p, vec2(-0.4, 0.6) * scale, 0.6 * scale, PI/8.0, 0.2 * scale));
  d = min(d, sdCapsuleFixed(p, vec2(0.2, -0.2) * scale, 0.4 * scale, 0.0, 0.2 * scale));
  // d = min(d, sdCapsuleFixed(p, vec2(0.4, -0.9), 0.8, PI/2.0));
  return d;
}

float digit5(vec2 p, float scale) {
  float d = sdCapsuleFixed(p, vec2(0.6, 0.6) * scale, 1.1 * scale, PI/2.0, 0.2 * scale);
  d = min(d, sdCapsuleFixed(p, vec2(-0.5, 0.5) * scale, 0.4 * scale, 0.0, 0.2 * scale));
  d = min(d, sdCapsuleFixed(p, vec2(0.6, -0.1) * scale, 0.4 * scale, 0.0, 0.2 * scale));
  d = min(d, sdCapsuleFixed(p, vec2(0.6, 0.0) * scale, 1.1 * scale, PI/2.0, 0.2 * scale));
  d = min(d, sdCapsuleFixed(p, vec2(0.6, -0.6) * scale, 1.1 * scale, PI/2.0, 0.2 * scale));
  // d = min(d, sdCapsuleFixed(p, vec2(-0.3, -0.9) * scale, 0.8, 0.0));
  return d;
}

float digit6(vec2 p, float scale) {
  float d = sdCapsuleFixed(p, vec2(-0.5, 0.5) * scale, 0.9 * scale, 0.0, 0.2 * scale);
  d = min(d, sdCapsuleFixed(p, vec2(0.6, -0.1) * scale, 0.4 * scale, 0.0, 0.2 * scale));
  d = min(d, sdCapsuleFixed(p, vec2(0.6, 0.0) * scale, 0.3 * scale, PI/2.0, 0.2 * scale));
  d = min(d, sdCapsuleFixed(p, vec2(0.6, -0.6) * scale, 1.1 * scale, PI/2.0, 0.2 * scale)); // lower horizontal
  d = min(d, sdCapsuleFixed(p, vec2(-0.5, -0.1) * scale, 0.4 * scale, 0.0, 0.2 * scale)); // vertical lower
  return d;
}

float digit7(vec2 p, float scale) {
  float d = sdCapsuleFixed(p, vec2(0.6, 0.6) * scale, 1.1 * scale, PI/2.0, 0.2 * scale);
  d = min(d, sdCapsuleFixed(p, vec2(0.6, 0.5) * scale, 1.3 * scale, PI/6.0, 0.2 * scale));
  return d;
}

float digit8(vec2 p, float scale) {
  float d = sdCapsuleFixed(p, vec2(0.6, 0.6) * scale, 1.1 * scale, PI/2.0, 0.2 * scale);
  d = min(d, sdCapsuleFixed(p, vec2(-0.5, 0.5) * scale, 0.4 * scale, 0.0, 0.2 * scale));
  d = min(d, sdCapsuleFixed(p, vec2(0.6, -0.1) * scale, 0.4 * scale, 0.0, 0.2 * scale));
  d = min(d, sdCapsuleFixed(p, vec2(0.6, 0.0) * scale, 1.1 * scale, PI/2.0, 0.2 * scale));
  d = min(d, sdCapsuleFixed(p, vec2(0.6, -0.6) * scale, 1.1 * scale, PI/2.0, 0.2 * scale));
  d = min(d, sdCapsuleFixed(p, vec2(-0.5, -0.1) * scale, 0.4 * scale, 0.0, 0.2 * scale));
  d = min(d, sdCapsuleFixed(p, vec2(0.6, 0.5) * scale, 1.1 * scale, 0.0, 0.2 * scale));
  return d;
}

float digit9(vec2 p, float scale) {
    // 6 upside down
    p = vec2(-p.x, -p.y);
    return digit6(p, scale);
}

// 10 is two capsules at an angle, to form a roman X
float digit10(vec2 p, float scale) {
    float d = sdCapsuleFixed(p, vec2(0.55, 0.55) * scale, 1.6 * scale, PI/4.0, 0.2 * scale);
    d = min(d, sdCapsuleFixed(p, vec2(-0.55, 0.55) * scale, 1.6 * scale, -PI/4.0, 0.2 * scale));
    return d;
}

float digit11(vec2 p, float scale) {
    float d = digit1(p, scale);
    p = vec2(p.x - 0.8 * scale, p.y);
    d = min(d, digit1(p, scale));
    return d;
}

float digit12(vec2 p, float scale) {
    float d = sdCapsuleFixed(p, vec2(0.70, 0.40) * scale, 0.6 * scale, PI/2.0, 0.2 * scale);
    d = min(d, sdCapsuleFixed(p, vec2(-0.60, 0.65) * scale, 1.3 * scale, 0.0, 0.2 * scale));
    d = min(d, sdCapsuleFixed(p, vec2(0.70, -0.4) * scale, 0.6 * scale, PI/2.0, 0.2 * scale));
    return d;
}

float digit13(vec2 p, float scale) {
    float d = sdCapsuleFixed(p, vec2(0.70, 0.70) * scale, 0.6 * scale, 1.9, 0.25 * scale);
    d = min(d, sdCapsuleFixed(p, vec2(-0.60, 0.75) * scale, 1.5 * scale, 0.0, 0.2 * scale));
    d = min(d, sdCapsuleFixed(p, vec2(0.70, 0.5) * scale, 0.6 * scale, 0.4, 0.2 * scale));
    d = min(d, sdCapsuleFixed(p, vec2(0.45, -0.10) * scale, 0.6 * scale, -0.5, 0.2 * scale));
    d = min(d, sdCapsuleFixed(p, vec2(0.7, -0.7) * scale, 0.6 * scale, PI/2.0 - 0.3, 0.20 * scale));
    return d;
}



void main() {


// Calculate the center of the screen
vec2 center = resolution.xy * 0.5;

// Position of the current fragment relative to the center
vec2 p = gl_FragCoord.xy;

vec2 uv = gl_FragCoord.xy / resolution.xy;

// Time-dependent parameters
float time = iTime;


float minDist = 1e10;
vec3 finalColor = vec3(0.0);

// vec2 tuv = uv;
// vec2 aspect = vec2(resolution.x / resolution.y, 1.0);
// tuv *= aspect;

// If width is less than height, scale the x axis
// if (aspect.x < aspect.y) {
//     tuv.x *= aspect.y / aspect.x;
// }  

for (int i = 0; i < 13; i++) {
    // first row of the u_boxes mat4 is [x,y, size, value]
    // second row of the u_boxes mat4 is [dx,dy,enemy, _pad_]

    // Use the u_boxes array to draw circles
    vec2 center = u_boxes[i][0].xy;
    float radius = u_boxes[i][0].z * 0.6;
    float value = u_boxes[i][0].w;
    float radiance = u_boxes[i][1].w;
    // color is in the 7, 8 and 9th index of the u_boxes mat4
    vec3 color = u_boxes[i][2].xyz / 255.0 * radiance * (0.75 + 0.25 * sin(float(i) + time * 2.0));


    // vec2 translatedUV = tuv;

    float sd = 1e10;
    // sd = max(sdBox(p - center, vec2(1.0)*radius), -sdBox(p - center, vec2(0.95)*radius));

    if(value < 0.1) {
        sd = min(sd, digit0(p - center, radius));
    } else if(value < 1.1) {
        sd = min(sd, digit1(p - center, radius));
    } else if (value < 2.1) {
        sd = min(sd, digit2(p - center, radius));
    }  else if (value < 3.1) {
        sd = min(sd, digit3(p - center, radius));
    } else if (value < 4.1) {
        sd = min(sd, digit4(p - center, radius));
    } else if (value < 5.1) {
        sd = min(sd, digit5(p - center, radius));
    } else if (value < 6.1) {
        sd = min(sd, digit6(p - center, radius));
    } else if (value < 7.1) {
        sd = min(sd, digit7(p - center, radius));
    } else if (value < 8.1) {
        sd = min(sd, digit8(p - center, radius));
    } else if (value < 9.1) {
        sd = min(sd, digit9(p - center, radius));
    } else if (value < 10.1) {
        sd = min(sd, digit10(p - center, radius));
    } else if (value < 11.1) {
        sd = min(sd, digit11(p - center, radius));
    } else if (value < 12.1) {
        sd = min(sd, digit12(p - center, radius));
    } else if (value < 13.1) {
        sd = min(sd, digit13(p - center, radius));
    } else {
        sd = min(sd, sdCircle(p, center, radius));
    }



    //sd = sdCircle(p, center, radius);

    if (sd < minDist) {
            minDist = sd;
            finalColor = color;
        }

    // vec2 glyphUV = (tuv)/ vec2(5.0, 5.0) + gridOffsetIdx / vec2(5.0, 5.0);

    //  // Ensure we are within the glyph's boundaries
    //     if (glyphUV.x >= gridOffsetIdx.x / 5.0 && glyphUV.x < (gridOffsetIdx.x + 1.0) / 5.0 &&
    //         glyphUV.y >= gridOffsetIdx.y / 5.0 && glyphUV.y < (gridOffsetIdx.y + 1.0) / 5.0) {
            
    //             float sd = texture(iChannel1, gridOffset(tuv, gridOffsetIdx.x, gridOffsetIdx.y)).r;
     

    
    //         }
    // Only fetch the texture if the current pixel is within the glyph

    // Your code here



}

// for (int i = 0; i < NUM_CAPSULES; i++) {
//     // Define the endpoints of the capsule in pixel space
//     vec2 a = vec2(-lengths[i], 0.0);
//     vec2 b = vec2(lengths[i], 0.0);

//     // Rotate the capsule
//     mat2 rotation = mat2(cos(rotations[i]), -sin(rotations[i]),
//                          sin(rotations[i]), cos(rotations[i]));
//     a = rotation * a;
//     b = rotation * b;

//     // Translate the capsule
//     a += positions[i];
//     b += positions[i];

//     // Calculate the SDF of the capsule
//     float sd = sdThirteen(p);

//     // Update the minimum distance and color if this capsule is closer
//     if (sd < minDist) {
//         minDist = sd;
//         finalColor = colors[i];
//     }
// }

// Add a circle at the mouse position
float mouseRadius = 30.0;
vec2 mousePos = iMouse.xy;

// Mouse movement is given in iMouseMovement.x and y, we
// want to calculate the opposite angle and rotate the capsule
float magnitude = iMouseMove.y;
float rotation = iMouseMove.x;  

float clicked = iMouse.z;
// If rotation is close to -PI, we want to null it and instead apply 'super' to the arms
if (rotation < -3.0 || rotation > 3.0) {
    clicked = 1.0;
}

// Calculate the SDF of the circle at the mouse position
// float sd = sdCapsuleFixed(p, mousePos, mouseRadius, rotation * magnitude * 15.0);
float sd = sdStickman2(p, mousePos, 20.0, rotation, clicked * u_superAvailable, magnitude);
// Determine the circle color based on the mouse state
vec3 circleColor;
if (iMouse.z > 0.0 && u_super > 0.0 && u_superAvailable > 0.0) {
    circleColor = vec3(2.0);
} else if (iMouse.w > 0.0) {
    circleColor = vec3(0.0, 0.0, 0.0); // White color if mouse is clicked
} else {
    circleColor = vec3(iMouseMove.z); // Default blue color
}
// circleColor = vec3(
//     0.5 + 0.5 * sin(time * 2.0),
//     0.5 + 4.5 * cos(time * 1.5),
//     0.5 + 0.5 * sin(time * 1.0)
// );



// float factor = 48.0 / min(resolution.x, resolution.y);
// float scaledDist = (1.0 - textColor.a) * factor;
// minDist = textColor.r;// * 90.0;

// minDist = 

// if (uv.x > 0.55 && uv.y > 0.4 && uv.x < 0.88 && uv.y < 0.6) {
//     finalColor = vec3(0.5 + 0.5*sin(iTime), 0.0, 0.0);
// }
// Output the final color
// fragColor = vec4(minDist, finalColor);

// The distance stored in textColor.a is the distance to the nearest text edge
 // but in glyph space, so we need to scale it to screen space
// vec4 textColor = texture(iChannel1, uv);
// float factor = 48.0 / min(resolution.x, resolution.y);
// float scaledDist = (1.0 - textColor.a) * factor;
// float dist = min(min(sd,minDist), textColor.r * 100.0);

if(u_gameStarted < 0.5) {
    vec2 middle = resolution.xy * 0.5;
    float d1 = digit1(p - middle - vec2(-75.0,0.0), 100.0);
    float d2 = digit3(p - middle - vec2(75.0,0.0), 100.0);

    float d3 = sdCapsuleFixed(rotate(p - middle - vec2(-200.0,sin(iTime+PI)*30.0), PI/2.0), vec2(0.0,-22.5), 45.0, PI, 7.0);
    float d4 = digit10(rotate(p - middle - vec2(-200.0,sin(iTime)*30.0), PI/4.0), 30.0);

    float d = min(d1, min(d2, min(d3, d4)));
    if(d1 < d2 && d1 < d3 && d1 < d4) {
        finalColor = vec3(0.0, 0.0, 0.0);
    } else if(d2 < d1 && d2 < d3 && d2 < d4) {
        finalColor = vec3(1.0, 0.0, 0.0);
    } else if(d3 < d1 && d3 < d2 && d3 < d4) {
        finalColor = vec3(1.0, 1.0, 1.0);
    } else if(d4 < d1 && d4 < d2 && d4 < d3) {
        finalColor = vec3(1.0, 1.0, 1.0);
    }
    minDist = min(d, minDist);

    // fragColor = vec4(min(minDist, d), color);}
}

// // Check if the circle is closer than the closest capsule
if (sd < minDist) {
    minDist = sd;
    finalColor = circleColor;
}
fragColor = vec4(minDist, finalColor);

  // // Output the final color

// fragColor = textColor;
  // // Calculate the center of the screen
  // vec2 center = resolution.xy * 0.5;

  // // Position of the current fragment relative to the center
  // vec2 p = gl_FragCoord.xy - center;

  // // Time-dependent parameters
  // float time = iTime;
  // float capsuleLength = 100.0 + 50.0 * sin(time * 0.5); // Varying length of the capsule in pixels
  // float capsuleRadius = 50.0 + 25.0 * cos(time * 0.7);  // Varying radius of the capsule in pixels
  // float rotationAngle = time * 6.0; // Rotation angle over time

  // // Define the endpoints of the capsule in pixel space
  // vec2 a = vec2(-capsuleLength, 0.0);
  // vec2 b = vec2( capsuleLength, 0.0);

  // // Rotate the capsule by the rotation angle
  // mat2 rotation = mat2(cos(rotationAngle), -sin(rotationAngle),
  //                      sin(rotationAngle),  cos(rotationAngle));
  // a = rotation * a;
  // b = rotation * b;

  // // Calculate the SDF of the capsule relative to the center
  // float sd = sdCapsule(p, a, b, capsuleRadius);

  // float sdCircle1 = sdCircle(p, vec2(-100.0, 0.0), 50.0);

//  // Calculate the center of the screen
  //   vec2 center = resolution.xy * 0.5;

  //   // Position of the current fragment relative to the center
  //   vec2 p = gl_FragCoord.xy - center;

  //   // Time-dependent parameters
  //   float time = iTime;
  //   float capsuleLength = 100.0 + 50.0 * sin(time * 0.5); // Varying length of the capsule in pixels
  //   float capsuleRadius = 50.0 + 25.0 * cos(time * 0.7);  // Varying radius of the capsule in pixels
  //   float rotationAngle = time * 6.0; // Rotation angle over time

  //   // Define the endpoints of the capsule in pixel space
  //   vec2 a = vec2(-capsuleLength, 0.0);
  //   vec2 b = vec2( capsuleLength, 0.0);

  //   // Rotate the capsule by the rotation angle
  //   mat2 rotation = mat2(cos(rotationAngle), -sin(rotationAngle),
  //                        sin(rotationAngle),  cos(rotationAngle));
  //   a = rotation * a;
  //   b = rotation * b;

  //   // Calculate the SDF of the capsule relative to the center
  //   float sd = sdCapsule(p, a, b, capsuleRadius);

  //   float sdCircle1 = sdCircle(p, vec2(-100.0, 0.0), 50.0);


  //   // Emissivity (color) changes over time, but each SDF is different
  //   vec3 emissivity = vec3(0.5 + 0.5 * sin(time * 2.0),
  //                          0.5 + 0.5 * cos(time * 1.5),
  //                          0.5 + 0.5 * sin(time * 1.0));
    
  //   vec3 colorCapsule = vec3(1.0, 0.5, 0.0); // Orange color for the capsule
  //   vec3 colorCircle = vec3(0.0, 0.5, 1.0);  // Blue color for the circle

  //   if (sd < sdCircle1) {
  //       fragColor = vec4(sd, colorCapsule);
  //   } else {  
  //       fragColor = vec4(sdCircle1, colorCircle);
  //   }
    

    // Combined SDF
    // float combinedSDF = min(sd, sdCircle1);

    // fragColor = vec4(combinedSDF, emissivity);
}