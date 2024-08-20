@nomangle GRID_HEIGHT GRID_WIDTH NUM_CAPSULES iMouse texture
#version 300 es
precision highp float;
uniform sampler2D iChannel0;  // Input from Common
uniform sampler2D iChannel1;  // Input from text atlas
uniform vec2 resolution;
uniform vec4 iMouse;
uniform vec2 iMouseMove;
out vec4 fragColor;
uniform float iTime; 
#define GRID_WIDTH 3
#define GRID_HEIGHT 3
#define NUM_CAPSULES (GRID_WIDTH * GRID_HEIGHT)

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
    
// float sdThree(vec2 p) {
//     // Parameters for the top circle
//     vec2 topCircleCenter = vec2(200.0, 300.0);  // Center of top circle in pixels
//     float topCircleRadius = 50.0;               // Radius of top circle in pixels
    
//     // Parameters for the bottom circle
//     vec2 bottomCircleCenter = vec2(200.0, 400.0);  // Center of bottom circle in pixels
//     float bottomCircleRadius = 50.0;               // Radius of bottom circle in pixels
    
//     // Square to cut off the left half
//     vec2 squareCenter = vec2(150.0, 350.0);   // Center of the cutting square
//     vec2 squareSize = vec2(50.0, 150.0);      // Size of the cutting square
    
//     // SDFs for the circles
//     float topCircleSDF = sdCircle(p, topCircleCenter, topCircleRadius);
//     float bottomCircleSDF = sdCircle(p, bottomCircleCenter, bottomCircleRadius);
    
//     // SDF for the cutting square
//     float squareSDF = sdSquare(p, squareCenter, squareSize);
    
//     // Cut the circles using the square SDF
//     topCircleSDF = max(topCircleSDF, -squareSDF);
//     bottomCircleSDF = max(bottomCircleSDF, -squareSDF);
    
//     // Combine the SDFs for the top and bottom parts of the "3"
//     return min(topCircleSDF, bottomCircleSDF);
// }


// float sdThirteen(vec2 p) {
//     // Offset positions for "1" and "3"
//     vec2 onePos = p + vec2(-0.6, 0.0);
//     vec2 threePos = p + vec2(0.6, 0.0);
    
//     // Compute the SDFs for "1" and "3"
//     float oneSDF = sdOne(onePos);
//     float threeSDF = sdThree(threePos);
    
//     // Combine the SDFs
//     return min(oneSDF, threeSDF);
// }

float sdCapsuleFixed(vec2 p, vec2 pos, float len, float rot) {
  vec2 ba = vec2(sin(rot), cos(rot)) * len; // default orientation is vertical
  vec2 pa = p - pos + ba; // top center

  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - 15.0;
}

// Main SDF function for the stickman

float sdStickman(vec2 p, vec2 pos, float headLen, float rot) {
    // Head - top capsule, serves as the parent for other parts
    float head = sdCapsuleFixed(p, pos, headLen, rot);

    // Body - positioned just below the head
    float bodyLen = headLen * 4.5; // example ratio
    vec2 bodyPos = pos - vec2(0, headLen + 30.0); // adjust for half lengths of head and body
    float body = sdCapsuleFixed(p, bodyPos, bodyLen, rot);

    // Legs - we'll assume they split at the bottom of the body
    float legLength = bodyLen * 0.75;
    float leg1 = sdCapsuleFixed(p, bodyPos - vec2(0.1 * bodyLen, 90.0), legLength, rot + 0.5); // Slight angle
    float leg2 = sdCapsuleFixed(p, bodyPos - vec2(-0.1 * bodyLen, 90.0), legLength, rot - 0.5); // Slight angle

    // Arms - positioned towards the middle of the body
    float armLength = bodyLen * 0.75;
    float arm1 = sdCapsuleFixed(p, bodyPos + vec2(0.2 * bodyLen, 0.0 * bodyLen), armLength, rot - 0.4); // Slight angle
    float arm2 = sdCapsuleFixed(p, bodyPos + vec2(-0.2 * bodyLen, 0.0 * bodyLen), armLength, rot + 0.4); // Slight angle

    // Combine all distances using the min function
    return min(min(min(head, body), min(leg1, leg2)), min(arm1, arm2));
}

void main() {


// Calculate the center of the screen
vec2 center = resolution.xy * 0.5;

// Position of the current fragment relative to the center
vec2 p = gl_FragCoord.xy - center;

vec2 uv = gl_FragCoord.xy / resolution.xy;

// Time-dependent parameters
float time = iTime;

// Arrays to store individual capsule properties
vec2 positions[NUM_CAPSULES];
float rotations[NUM_CAPSULES];
vec3 colors[NUM_CAPSULES];
float lengths[NUM_CAPSULES];
float radii[NUM_CAPSULES];

// Initialize capsule properties
float gridSpacingX = resolution.x * 0.8 / float(GRID_WIDTH);
float gridSpacingY = resolution.y * 0.8 / float(GRID_HEIGHT);
vec2 gridOffset = vec2(-gridSpacingX * float(GRID_WIDTH - 1) * 0.5,
                       -gridSpacingY * float(GRID_HEIGHT - 1) * 0.5);

for (int y = 0; y < GRID_HEIGHT; y++) {
    for (int x = 0; x < GRID_WIDTH; x++) {
        int i = y * GRID_WIDTH + x;
        positions[i] = gridOffset + vec2(float(x) * gridSpacingX, float(y) * gridSpacingY);
        rotations[i] = time * (0.0 + float(i) * 0.2);
        colors[i] = vec3(0.0, 0.0, 0.0);
        // colors[i] = vec3(0.5 + 0.5 * sin(time + 4.0*float(i)),
        //                  0.5 + 0.5 * cos(time * 1.5 + float(i)),
        //                  0.5 + 0.5 * sin(time * 2.0 + float(i)));

        // Every 3rd capsule is black, without a conditional
        colors[i] = mix(colors[i], vec3(0.0), float(i % 1 != 0));
        
        lengths[i] = 60.0 + 20.0 * sin(time * 0.5 + float(i));
        radii[i] = 20.0 + 10.0 * cos(time * 0.7 + float(i));
    }
}

float minDist = 1e10;
vec3 finalColor = vec3(0.0);

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
vec2 mousePos = iMouse.xy - center;

// Mouse movement is given in iMouseMovement.x and y, we
// want to calculate the opposite angle and rotate the capsule
float magnitude = iMouseMove.y;
float rotation = iMouseMove.x;  
// But the magnitude of the mouse movement is also important,
// as slow moving mouse should rotate the capsule less


// Calculate the SDF of the circle at the mouse position
// float sd = sdCapsuleFixed(p, mousePos, mouseRadius, rotation * magnitude * 15.0);
float sd = sdStickman(p, mousePos, 20.0, rotation * magnitude * 15.0);
// Determine the circle color based on the mouse state
vec3 circleColor;
if (iMouse.z > 0.0) {
    circleColor = vec3(10.0, 10.0, 10.0); // Red color if mouse is down
} else if (iMouse.w > 0.0) {
    circleColor = vec3(10.0, 10.0, 10.0); // Green color if mouse is clicked
} else {
    circleColor = vec3(magnitude * 5.0, 0.0, 0.0); // Default blue color
}
// circleColor = vec3(
//     0.5 + 0.5 * sin(time * 2.0),
//     0.5 + 4.5 * cos(time * 1.5),
//     0.5 + 0.5 * sin(time * 1.0)
// );


vec4 textColor = texture(iChannel1, uv);
// float factor = 48.0 / min(resolution.x, resolution.y);
// float scaledDist = (1.0 - textColor.a) * factor;
minDist = textColor.r * 90.0;

// minDist = 
// // Check if the circle is closer than the closest capsule
if (sd < minDist) {
    minDist = sd;
    finalColor = circleColor;
}

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

fragColor = vec4(minDist, finalColor);

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